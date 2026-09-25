# GBA emulator — gpSP compiled to WebAssembly

The terminal's `gba` command runs **gpSP**, the Game Boy Advance emulator of
the GP2X / PSP homebrew scene (C, with ARM/MIPS/x86 dynamic recompilers),
compiled to WebAssembly with Emscripten.

- **Interpreter core**: WebAssembly cannot run the native ARM/MIPS/x86
  recompilers (generating and executing machine code at run time is not
  allowed in a browser), so the portable C interpreter is used. It runs a
  frame in well under 1 ms on a desktop PC, far below the 16.7 ms budget.
- **Built-in open-source BIOS** (Normmatt / VBA-M team): no Nintendo BIOS needed.
- **Local only**: the ROM is read by the browser from the visitor's disk and
  emulated on their machine. Nothing is uploaded; battery saves, quick states
  and the last ROM are kept in the browser's IndexedDB.

| File | Role |
|---|---|
| `web_frontend.c` | minimal libretro frontend: video / audio / input bridge and the small C API used by JavaScript |
| `build.sh` | fetches gpSP at a pinned commit and builds `assets/vendor/gpsp/gpsp.{js,wasm}` |
| `../../assets/js/terminal-commands/gba.js` | the terminal command: file picker / drag & drop, game loop on `ctx.createGame`, audio, saves, touch pad |

## Rebuild

```bash
git clone https://github.com/emscripten-core/emsdk && cd emsdk
./emsdk install latest && ./emsdk activate latest && source ./emsdk_env.sh
cd /path/to/jekyll-infops-theme
./tools/gba-emulator/build.sh
```

## Licences

gpSP and its BIOS are **GPL-2.0**; `web_frontend.c` and `build.sh` are GPL-2.0
too. They are separate programs shipped alongside the MIT-licensed theme
(`assets/vendor/gpsp/COPYING`, `assets/vendor/gpsp/SOURCE.md` names the exact
source commit).

## Using it

Only play ROMs you are allowed to use (your own cartridge dumps, homebrew,
public-domain games). The site never hosts or distributes ROMs.

Disable it by removing `gba.js` from `_layouts/default.html` (the ~500 KB
emulator is only downloaded when someone types `gba`, never at page load).
