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
| `../../assets/js/terminal-commands/gba-compile-worker.js` | compiles the WebAssembly when the page may not |
| `web_frontend.c` | minimal libretro frontend: video / audio / input bridge and the small C API used by JavaScript |
| `build.sh` | fetches gpSP at a pinned commit, applies a small RTC fix and builds `assets/vendor/gpsp/gpsp.{js,wasm}` plus `gpsp-js.js` (last-resort fallback without WebAssembly) |
| `../../assets/js/terminal-commands/gba.js` | the terminal command: file picker / drag & drop, game loop on `ctx.createGame`, audio, saves, touch pad |

## Without WebAssembly (antivirus)

Some antivirus products (Kaspersky…) rewrite the page's security policy and
drop `'wasm-unsafe-eval'`, which forbids compiling WebAssembly in the page.
The command then tries, in order:

1. **WebAssembly compiled in a worker** (`gba-compile-worker.js`): a worker is
   governed by the policy sent with its own script, which these products leave
   alone; the compiled module is handed back to the page, which only
   instantiates it. Full speed.
   The worker script is sent without any Content-Security-Policy header
   (`apache/site-common.conf`, `docker/nginx.conf`): with no header, there is
   nothing for the antivirus to rewrite.
2. **Plain JavaScript** (`gpsp-js.js`, the same core built with wasm2js, no
   eval): works everywhere but is much slower, because the CPU interpreter is
   one function too large for the browser's optimising compiler. It is also
   what runs in browsers without a JIT (Edge's "Enhance your security on the
   web" mode disables both the JIT and WebAssembly on sites you rarely visit):
   the terminal then says so and how to add an exception.

## Cartridge clock (RTC)

Games with a real-time clock (Pokémon Ruby / Sapphire / Emerald…) read the
PC's clock. gpSP's RTC decoded status writes in the wrong bit order, so after
the game reset the clock it reported "The internal battery has run dry";
`build.sh` patches it.

## Optional: a ROM library on your server

```yaml
# _config.yml
theme_config:
  gba:
    library: "/assets/roms/roms.json"   # same-origin URL of the list
```

`roms.json` lists the files, relative to the JSON file (`.gba` or `.zip`):

```json
{ "roms": [
  { "name": "My homebrew game", "file": "my-game.gba", "size": 4194304, "info": "homebrew" }
] }
```

The menu shows the list with a filter, downloads the chosen file with a
progress bar (size, speed, cancel) and starts it. Only list games you are
allowed to distribute (homebrew, public domain, your own creations).

## Saves

- kept automatically in the browser (IndexedDB), per game;
- **Download .sav / Import .sav** from the menu (standard raw `.sav`, usable
  with other emulators);
- **Keep the save in a file on this PC** (Chrome / Edge): pick a `.sav` file
  once, it is then rewritten every few seconds while playing and read back
  the next time the game starts.

## Settings (menu → ⚙)

Key bindings (any key, per action), smoothing / anti-aliasing, pixel-perfect
integer scaling, scanlines, GBA LCD colour correction, frame blending, FPS
counter, volume / mute, fast-forward speed. Stored in the browser.

## Performance

The game loop never spends more than 75 % of the real time emulating (a
machine that cannot keep up gets a slightly slower game, not a spiral down to
a few fps), and when a frame costs more than 10 ms gpSP skips drawing 1–3
frames out of every few (`gpsp_frameskip = fixed_interval`), until it is fast
enough again.

gpSP runs a frame in ~0.3 ms in Chromium on a desktop PC (budget 16.7 ms).
WebAssembly SIMD (`-msimd128`) and LTO were measured and bring nothing
(LTO is slower and larger), so the build uses plain `-O3`
(`OPT_FLAGS=... ./build.sh` to experiment).

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
