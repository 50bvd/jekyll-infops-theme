#!/usr/bin/env bash
# =============================================================================
# tools/gba-emulator/build.sh — build gpSP (GBA emulator) to WebAssembly
#
#   ./tools/gba-emulator/build.sh
#
# Output: assets/vendor/gpsp/gpsp.js + gpsp.wasm, gpsp-js.js (no-WebAssembly
# fallback) and the licence / source notes.
# Needs the Emscripten SDK (emcc in PATH: `source emsdk/emsdk_env.sh`) and git.
# The gpSP sources are fetched at the pinned commit below, so the build is
# reproducible and the exact source of the shipped binary is known (GPL-2.0).
# =============================================================================
set -euo pipefail

GPSP_REPO="https://github.com/libretro/gpsp.git"
GPSP_COMMIT="5819380c2ffb0900219d700a382ee68c464ebb99"

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
WORK="${WORK:-$HERE/.build}"
OUT="${OUT:-$ROOT/assets/vendor/gpsp}"

command -v emcc >/dev/null || { echo "emcc not found: source <emsdk>/emsdk_env.sh first" >&2; exit 1; }

# ── Sources ──────────────────────────────────────────────────────────────────
if [ ! -d "$WORK/gpsp/.git" ]; then
  mkdir -p "$WORK"
  git clone --quiet "$GPSP_REPO" "$WORK/gpsp"
fi
git -C "$WORK/gpsp" fetch --quiet origin "$GPSP_COMMIT" 2>/dev/null || true
git -C "$WORK/gpsp" checkout --quiet "$GPSP_COMMIT"
SRC="$WORK/gpsp"
LC="$SRC/libretro/libretro-common"

# RTC fix (Pokémon Ruby / Sapphire / Emerald "The internal battery has run
# dry"): the Seiko RTC receives data bytes LSB first (commands MSB first), but
# gpSP shifted status writes in MSB first, and treated the reset command as a
# status write. After the game resets the clock (and writes 24-hour mode) the
# status read back without the 24-hour flag, which the game reports as a dead
# battery. Idempotent: re-running the build does not patch twice.
python3 - "$SRC/gba_memory.c" <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
if 'infops: RTC LSB-first' not in s:
    old_cmd = """        case RTC_COMMAND_RESET:
        case RTC_COMMAND_WRITE_STATUS:"""
    new_cmd = """        case RTC_COMMAND_RESET:
          /* infops: RTC LSB-first fix. Reset takes no data and clears the
           * status register (the game then writes 24-hour mode). */
          rtc_status = 0;
          rtc_state = RTC_IDLE;
          break;
        case RTC_COMMAND_WRITE_STATUS:"""
    old_in = """      rtc_data <<= 1;
      rtc_data |= ((new >> 1) & 1);
      rtc_data_bits--;
      if (!rtc_data_bits) {
        rtc_status = rtc_data; // HACK: assuming write status here."""
    new_in = """      /* data bytes are sent LSB first */
      rtc_data |= ((u64)((new >> 1) & 1)) << (8 - rtc_data_bits);
      rtc_data_bits--;
      if (!rtc_data_bits) {
        rtc_status = rtc_data & 0x7F;   /* bit 7 (power failure) is read-only */"""
    assert s.count(old_cmd) == 1 and s.count(old_in) == 1, 'gpSP RTC code changed: update the patch'
    s = s.replace(old_cmd, new_cmd).replace(old_in, new_in)
    open(p, 'w').write(s)
PY

# The built-in BIOS is embedded with `.incbin` in bios_data.S, which the
# WebAssembly assembler does not support: generate the same symbol in C.
python3 - "$SRC/bios/open_gba_bios.bin" "$WORK/bios_data.c" <<'PY'
import sys
data = open(sys.argv[1], 'rb').read()
assert len(data) == 16384, len(data)
rows = ',\n'.join(', '.join(str(b) for b in data[i:i+32]) for i in range(0, len(data), 32))
open(sys.argv[2], 'w').write('#include <stdint.h>\nuint8_t open_gba_bios_rom[16384] = {\n%s\n};\n' % rows)
PY

C_SOURCES=(
  main.c gba_memory.c savestate.c input.c sound.c cheats.c memmap.c serial.c
  gbp.c rfu.c serial_proto.c libretro/libretro.c gba_cc_lut.c
)
LC_SOURCES=(
  compat/compat_posix_string.c compat/compat_strl.c compat/fopen_utf8.c
  encodings/encoding_utf.c file/file_path.c file/file_path_io.c
  streams/file_stream.c string/stdstring.c time/rtime.c vfs/vfs_implementation.c
)
CC_SOURCES=(video.cc cpu.cc)

# shellcheck disable=SC2206  # OPT_FLAGS is a list of flags: split on purpose
FLAGS=(-O3 ${OPT_FLAGS:-} -DNDEBUG -DHAVE_STRINGS_H -DHAVE_STDINT_H -DHAVE_INTTYPES_H -D__LIBRETRO__ -DINLINE=inline
       -I"$SRC/libretro" -I"$LC/include" -I"$SRC" -w)

OBJ="$WORK/obj"; rm -rf "$OBJ"; mkdir -p "$OBJ"
i=0
for f in "${C_SOURCES[@]}";  do emcc "${FLAGS[@]}" -c "$SRC/$f" -o "$OBJ/$((i++)).o"; done
for f in "${LC_SOURCES[@]}"; do emcc "${FLAGS[@]}" -c "$LC/$f"  -o "$OBJ/$((i++)).o"; done
for f in "${CC_SOURCES[@]}"; do em++ "${FLAGS[@]}" -fno-exceptions -fno-rtti -c "$SRC/$f" -o "$OBJ/${f%.cc}.o"; done
emcc "${FLAGS[@]}" -c "$WORK/bios_data.c"      -o "$OBJ/bios.o"
emcc "${FLAGS[@]}" -c "$HERE/web_frontend.c"   -o "$OBJ/frontend.o"

# JavaScript build only: the CPU interpreter split into small functions that
# browsers can optimise (split_interpreter.py; same behaviour, see there)
OBJ_JS="$WORK/obj-js"; rm -rf "$OBJ_JS"; mkdir -p "$OBJ_JS"
cp "$OBJ"/*.o "$OBJ_JS"/ && rm "$OBJ_JS/cpu.o"
python3 "$HERE/split_interpreter.py" "$SRC/cpu.cc" "$WORK/cpu_split.cc"
em++ "${FLAGS[@]}" -fno-exceptions -fno-rtti -c "$WORK/cpu_split.cc" -o "$OBJ_JS/cpu_split.o"

# ── Link ─────────────────────────────────────────────────────────────────────
# No eval / new Function in the JS glue (works under the site's CSP; WebAssembly
# compilation itself needs 'wasm-unsafe-eval', added by _includes/csp.html).
mkdir -p "$OUT"
em++ -O3 ${OPT_FLAGS:-} "$OBJ"/*.o -o "$OUT/gpsp.js" \
  -sMODULARIZE=1 -sEXPORT_NAME=createGpsp -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=1MB \
  -sDYNAMIC_EXECUTION=0 -sFILESYSTEM=1 -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_RUNTIME_METHODS=FS,HEAPU8,HEAP16,HEAPU16 \
  -sEXPORTED_FUNCTIONS=_malloc,_free,_gba_init,_gba_load,_gba_run_frame,_gba_reset,_gba_set_keys,_gba_frame_ptr,_gba_audio_ptr,_gba_audio_frames,_gba_sample_rate,_gba_fps,_gba_sram_ptr,_gba_sram_size,_gba_state_save,_gba_state_load,_gba_state_ptr,_gba_state_size,_gba_set_option \
  -sEXIT_RUNTIME=0 -sASSERTIONS=0

# Same core compiled to plain JavaScript (wasm2js), loaded only when the page
# may not compile WebAssembly: some antivirus products (Kaspersky…) replace
# the site's script-src with their own, without 'wasm-unsafe-eval'. Slower
# and larger, but it needs no eval of any kind.
em++ -O3 ${OPT_FLAGS:-} "$OBJ_JS"/*.o -o "$OUT/gpsp-js.js" \
  -sWASM=0 \
  -sMODULARIZE=1 -sEXPORT_NAME=createGpspJs -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=1MB \
  -sDYNAMIC_EXECUTION=0 -sFILESYSTEM=1 -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_RUNTIME_METHODS=FS,HEAPU8,HEAP16,HEAPU16 \
  -sEXPORTED_FUNCTIONS=_malloc,_free,_gba_init,_gba_load,_gba_run_frame,_gba_reset,_gba_set_keys,_gba_frame_ptr,_gba_audio_ptr,_gba_audio_frames,_gba_sample_rate,_gba_fps,_gba_sram_ptr,_gba_sram_size,_gba_state_save,_gba_state_load,_gba_state_ptr,_gba_state_size,_gba_set_option \
  -sEXIT_RUNTIME=0 -sASSERTIONS=0

cp "$SRC/COPYING" "$OUT/COPYING"
cat > "$OUT/SOURCE.md" <<EOF
# gpSP — WebAssembly build

- Emulator: gpSP (libretro), GPL-2.0 — see COPYING
- Source: $GPSP_REPO @ \`$GPSP_COMMIT\`
- Patch applied by build.sh: RTC status writes (LSB first) and reset command, fixing "The internal battery has run dry" in Pokémon Ruby / Sapphire / Emerald
- Built-in BIOS: open-source replacement by Normmatt / VBA-M team (GPL-2.0), \`bios/\` in the gpSP sources
- Frontend and build script: \`tools/gba-emulator/\` in this repository
- Rebuild: \`./tools/gba-emulator/build.sh\` (Emscripten $(emcc --version | head -1 | sed 's/.*) //'))
EOF
ls -la "$OUT"
