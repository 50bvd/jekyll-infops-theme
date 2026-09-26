#!/usr/bin/env python3
"""
split_interpreter.py — rewrites gpSP's CPU interpreter (cpu.cc) for the plain
JavaScript build (wasm2js).

execute_arm_internal() is one huge function (ARM + Thumb decoders, ~2000
lines once the macros expand). Compiled to JavaScript it becomes a ~180 KB
function, far above the size browsers' optimising compilers accept, so it
runs in V8's baseline tier. This script moves the two instruction decoders
into many small functions the JIT can optimise:

  * the interpreter's local variables become fields of a struct shared by
    the functions (names are mapped with macros, so the instruction code and
    gpSP's macros stay untouched);
  * `goto` targets (skip_instruction, arm_loop, thumb_loop, alert) become
    return codes, dispatched back to the same labels in the main loop;
  * each 256-case decoder switch is cut into several functions by opcode
    range, at case boundaries that cannot fall through.

The WebAssembly build keeps the original file (it is already fast there and
the extra calls would only cost). Output behaviour is identical: build.sh
compares both builds frame by frame on test ROMs.

usage: split_interpreter.py cpu.cc out.cc [arm_parts] [thumb_parts]
"""
import re
import sys

src_path, out_path = sys.argv[1], sys.argv[2]
ARM_PARTS = int(sys.argv[3]) if len(sys.argv) > 3 else 8
THUMB_PARTS = int(sys.argv[4]) if len(sys.argv) > 4 else 4

src = open(src_path).read()

# Every jump goes through a macro, so the step functions can turn it into a return
for label in ('skip_instruction', 'arm_loop', 'thumb_loop', 'alert'):
    src = re.sub(r'\bgoto\s+%s\b' % label, 'INTERP_GOTO(%s)' % label, src)

lines = src.split('\n')


def find(pattern, start=0):
    rx = re.compile(pattern)
    for i in range(start, len(lines)):
        if rx.search(lines[i]):
            return i
    raise SystemExit('split_interpreter: pattern not found: ' + pattern)


fn_start = find(r'^static u32 execute_arm_internal\(u32 cycles, bool vram_only\)')
fn_end = find(r'^}\s*$', fn_start)

arm_fetch = find(r'opcode = readaddress32\(pc_address_block', fn_start)
arm_skip = find(r'^skip_instruction:', arm_fetch)
thumb_fetch = find(r'opcode = readaddress16\(pc_address_block', arm_skip)
thumb_end = find(r'/\* End of Execute THUMB instruction \*/', thumb_fetch)
assert fn_start < arm_fetch < arm_skip < thumb_fetch < thumb_end < fn_end

arm_body = lines[arm_fetch + 1:arm_skip]
thumb_body = lines[thumb_fetch + 1:thumb_end]

for name, body in (('ARM', arm_body), ('Thumb', thumb_body)):
    text = '\n'.join(body)
    if re.search(r'\breturn\b|\bcontinue\s*;', text):
        raise SystemExit('split_interpreter: %s decoder contains return/continue: update the script' % name)


def strip_comments(line, state):
    """Line without comments / strings (for brace counting); state = in /* */."""
    out, i = [], 0
    while i < len(line):
        if state['c']:
            j = line.find('*/', i)
            if j < 0:
                return ''.join(out)
            state['c'] = False
            i = j + 2
        elif line.startswith('/*', i):
            state['c'] = True
            i += 2
        elif line.startswith('//', i):
            break
        elif line[i] in '"\'':
            q, i = line[i], i + 1
            while i < len(line) and line[i] != q:
                i += 2 if line[i] == '\\' else 1
            i += 1
        else:
            out.append(line[i])
            i += 1
    return ''.join(out)


def split_body(body, switch_rx, parts):
    """-> (prefix lines, switch expression, [case segments], suffix lines)."""
    k = next(i for i, l in enumerate(body) if re.search(switch_rx, l))
    expr = re.search(r'switch\s*(\(.*\))\s*$', body[k].strip()).group(1)
    assert body[k + 1].strip() == '{', 'expected { after the decoder switch'
    state, depth, segs, cur, pre_depth = {'c': False}, 1, [], None, 0
    i = k + 2
    while True:
        line = body[i]
        code = strip_comments(line, state)
        stripped = line.strip()
        if depth == 1 and code.strip() == '}':
            break
        if depth == 1 and pre_depth == 0 and re.match(r'(case\b|default\s*:)', stripped):
            # a new top-level case starts a segment unless it directly follows
            # another case label (grouped labels stay together)
            if cur is None or not re.match(r'^\s*(case\b.*|default\s*):\s*$', cur[-1]):
                cur = []
                segs.append(cur)
        if stripped.startswith('#if'):
            pre_depth += 1
            if depth == 1 and cur is not None and pre_depth == 1:
                # an #if block at case level starts its own segment
                cur = []
                segs.append(cur)
        elif stripped.startswith('#endif'):
            pre_depth -= 1
        if cur is None:
            raise SystemExit('split_interpreter: code before the first case')
        cur.append(line)
        depth += code.count('{') - code.count('}')
        i += 1
    return body[:k], expr, segs, body[i + 1:]


def ends_cleanly(seg):
    """True when control cannot fall through to the next case."""
    state, code = {'c': False}, []
    for l in seg:
        c = strip_comments(l, state).strip()
        if c and not c.startswith('#'):
            code.append(c)
    last = code[-1] if code else ''
    return bool(re.search(r'(\bbreak\s*;|INTERP_GOTO\(\w+\)\s*;?|_next_instruction\(\)\s*;|^\})\s*$', last))


def chunk(segs, parts):
    total = sum(len(s) for s in segs)
    target, out, cur, size = total / parts, [], [], 0
    for idx, s in enumerate(segs):
        cur.append(s)
        size += len(s)
        last = idx == len(segs) - 1
        if not last and size >= target and len(out) < parts - 1 and ends_cleanly(s):
            out.append(cur)
            cur, size = [], 0
    out.append(cur)
    return out


def labels_of(seg):
    """Opcode values handled by a segment (its leading top-level case labels)."""
    vals, state = set(), {'c': False}
    for l in seg:
        c = strip_comments(l, state).strip()
        if not c or c.startswith('#'):
            continue
        m = re.match(r'^case\s+(\w+)\s*(?:\.\.\.\s*(\w+))?\s*:\s*(.*)$', c)
        if not m:
            break
        lo = int(m.group(1), 0)
        hi = int(m.group(2), 0) if m.group(2) else lo
        vals.update(range(lo, hi + 1))
        if m.group(3):            # code on the same line as the label
            break
    if not vals:
        raise SystemExit('split_interpreter: segment without a case label')
    return vals


FIELDS = [
    ('u32', 'opcode'), ('u32', 'condition'),
    ('u32', 'n_flag'), ('u32', 'z_flag'), ('u32', 'c_flag'), ('u32', 'v_flag'),
    ('u32', 'pc_region'), ('u8 *', 'pc_address_block'), ('u32', 'new_pc_region'),
    ('s32', 'cycles_remaining'), ('u32', 'update_ret'), ('cpu_alert_type', 'cpu_alert'),
]

out = []
emit = out.append


def emit_decoder(kind, body, switch_rx, parts):
    prefix, expr, segs, suffix = split_body(body, switch_rx, parts)
    if any(l.strip() for l in suffix):
        raise SystemExit('split_interpreter: code after the %s decoder switch' % kind)
    groups = chunk(segs, parts)
    for n, g in enumerate(groups):
        emit('static __attribute__((noinline)) int %s_part%d(struct interp_state *st)' % (kind, n))
        emit('{')
        emit('  switch%s' % expr)
        emit('  {')
        for s in g:
            out.extend(s)
        emit('  }')
        emit('  return STEP_next;')
        emit('}')
        emit('')
    # opcode index -> part (a table: the cases are not in ascending order)
    table = [0] * 256
    seen = set()
    for n, g in enumerate(groups):
        for seg in g:
            vals = labels_of(seg)
            if vals & seen:
                raise SystemExit('split_interpreter: %s opcode handled twice' % kind)
            seen |= vals
            for v in vals:
                table[v] = n
    emit('static const u8 %s_part_of[256] = {' % kind)
    for r in range(0, 256, 16):
        emit('  ' + ', '.join(str(x) for x in table[r:r + 16]) + ',')
    emit('};')
    emit('')
    # Called through a (non-const) table of pointers: an indirect call cannot
    # be inlined back by wasm2js' optimiser, which would rebuild the giant
    # function (it inlines every function that has a single caller)
    emit('static int (*volatile %s_parts[%d])(struct interp_state *) = {' % (kind, len(groups)))
    emit('  ' + ', '.join('%s_part%d' % (kind, n) for n in range(len(groups))))
    emit('};')
    emit('')
    emit('static inline int %s_step(struct interp_state *st)' % kind)
    emit('{')
    out.extend(prefix)
    emit('  return %s_parts[%s_part_of[%s]](st);' % (kind, kind, expr))
    emit('}')
    emit('')
    return len(groups)


# ── file before the interpreter, untouched ──
out.extend(lines[:fn_start])

emit('/* ---- infops: interpreter split into small functions (split_interpreter.py) ---- */')
emit('struct interp_state {')
for t, n in FIELDS:
    emit('  %s %s;' % (t, n))
emit('};')
emit('enum { STEP_next = 0, STEP_skip_instruction, STEP_arm_loop, STEP_thumb_loop, STEP_alert };')
for _, n in FIELDS:
    emit('#define %s (st->%s)' % (n, n))
emit('#undef INTERP_GOTO')
emit('#define INTERP_GOTO(label) return STEP_##label')
emit('')
arm_n = emit_decoder('arm', arm_body, r'switch\(\(opcode >> 20\) & 0xFF\)', ARM_PARTS)
thumb_n = emit_decoder('thumb', thumb_body, r'switch\(\(opcode >> 8\) & 0xFF\)', THUMB_PARTS)
emit('#undef INTERP_GOTO')
emit('#define INTERP_GOTO(label) goto label')
emit('')

DISPATCH = ('       switch (%s_step(st)) {'
            ' case STEP_arm_loop: goto arm_loop;'
            ' case STEP_thumb_loop: goto thumb_loop;'
            ' case STEP_alert: goto alert;'
            ' default: break; }')

# ── the interpreter loop, with its locals moved to the struct ──
fn = lines[fn_start:fn_end + 1]
rel = lambda i: i - fn_start
body_out = []
i = 0
decl_rx = re.compile(r'^\s*(u32|u8|s32|cpu_alert_type)\b[^;(]*;\s*$')
while i < len(fn):
    line = fn[i]
    if i == rel(arm_fetch) + 1:
        body_out.append(DISPATCH % 'arm')
        i = rel(arm_skip)
        continue
    if i == rel(thumb_fetch) + 1:
        body_out.append(DISPATCH % 'thumb')
        i = rel(thumb_end)
        continue
    if i < rel(arm_fetch):
        m = re.match(r'^(\s*)(?:u32|u8 \*|s32)\s*(pc_region|pc_address_block)\s*=(.*)$', line)
        if m:
            body_out.append('%s%s =%s' % (m.group(1), m.group(2), m.group(3)))
            i += 1
            continue
        if decl_rx.match(line) and any(re.search(r'\b%s\b' % n, line) for _, n in FIELDS):
            i += 1
            continue
        if line.strip() == '{' and i == 1:
            body_out.append(line)
            body_out.append('  struct interp_state state_storage = {0};')
            body_out.append('  struct interp_state *st = &state_storage;')
            i += 1
            continue
    body_out.append(line)
    i += 1
out.extend(body_out)

for _, n in FIELDS:
    emit('#undef %s' % n)
emit('/* ---- end of infops split ---- */')

# ── rest of the file (execute_arm, execute_arm_vram, …) ──
out.extend(lines[fn_end + 1:])

# INTERP_GOTO must exist for the macros used anywhere in the file
text = '\n'.join(out)
text = text.replace('\n#include', '\n#define INTERP_GOTO(label) goto label\n#include', 1) \
    if '#define INTERP_GOTO(label) goto label\n#include' not in text else text
open(out_path, 'w').write(text)
sys.stderr.write('split_interpreter: ARM decoder in %d functions, Thumb in %d\n' % (arm_n, thumb_n))
