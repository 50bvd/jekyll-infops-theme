#!/usr/bin/env bash
# =============================================================================
# tools/gba-emulator/build.sh — build gpSP (GBA emulator) to WebAssembly
#
#   ./tools/gba-emulator/build.sh
#
# Output: assets/vendor/gpsp/gpsp.js + gpsp.wasm (+ licence / source notes).
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
OUT="$ROOT/assets/vendor/gpsp"

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

FLAGS=(-O3 -DNDEBUG -DHAVE_STRINGS_H -DHAVE_STDINT_H -DHAVE_INTTYPES_H -D__LIBRETRO__ -DINLINE=inline
       -I"$SRC/libretro" -I"$LC/include" -I"$SRC" -w)

OBJ="$WORK/obj"; rm -rf "$OBJ"; mkdir -p "$OBJ"
i=0
for f in "${C_SOURCES[@]}";  do emcc "${FLAGS[@]}" -c "$SRC/$f" -o "$OBJ/$((i++)).o"; done
for f in "${LC_SOURCES[@]}"; do emcc "${FLAGS[@]}" -c "$LC/$f"  -o "$OBJ/$((i++)).o"; done
for f in "${CC_SOURCES[@]}"; do em++ "${FLAGS[@]}" -fno-exceptions -fno-rtti -c "$SRC/$f" -o "$OBJ/$((i++)).o"; done
emcc "${FLAGS[@]}" -c "$WORK/bios_data.c"      -o "$OBJ/bios.o"
emcc "${FLAGS[@]}" -c "$HERE/web_frontend.c"   -o "$OBJ/frontend.o"

# ── Link ─────────────────────────────────────────────────────────────────────
# No eval / new Function in the JS glue (works under the site's CSP; WebAssembly
# compilation itself needs 'wasm-unsafe-eval', added by _includes/csp.html).
mkdir -p "$OUT"
em++ -O3 "$OBJ"/*.o -o "$OUT/gpsp.js" \
  -sMODULARIZE=1 -sEXPORT_NAME=createGpsp -sENVIRONMENT=web \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=1MB \
  -sDYNAMIC_EXECUTION=0 -sFILESYSTEM=1 -sFORCE_FILESYSTEM=1 \
  -sEXPORTED_RUNTIME_METHODS=FS,HEAPU8,HEAP16,HEAPU16 \
  -sEXPORTED_FUNCTIONS=_malloc,_free,_gba_init,_gba_load,_gba_run_frame,_gba_reset,_gba_set_keys,_gba_frame_ptr,_gba_audio_ptr,_gba_audio_frames,_gba_sample_rate,_gba_fps,_gba_sram_ptr,_gba_sram_size,_gba_state_save,_gba_state_load,_gba_state_ptr,_gba_state_size \
  -sEXIT_RUNTIME=0 -sASSERTIONS=0

cp "$SRC/COPYING" "$OUT/COPYING"
cat > "$OUT/SOURCE.md" <<EOF
# gpSP — WebAssembly build

- Emulator: gpSP (libretro), GPL-2.0 — see COPYING
- Source: $GPSP_REPO @ \`$GPSP_COMMIT\`
- Built-in BIOS: open-source replacement by Normmatt / VBA-M team (GPL-2.0), \`bios/\` in the gpSP sources
- Frontend and build script: \`tools/gba-emulator/\` in this repository
- Rebuild: \`./tools/gba-emulator/build.sh\` (Emscripten $(emcc --version | head -1 | sed 's/.*) //'))
EOF
ls -la "$OUT"
