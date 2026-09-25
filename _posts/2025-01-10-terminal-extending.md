---
layout: post
title: "Terminal — Creating Commands, Games & Interactive Programs"
description: "How to add your own commands, games, and interactive canvas programs to the jekyll-infops-theme terminal."
date: 2025-01-10
categories: [Documentation]
tags: [terminal, javascript, games, customization]
author: 50bvd
toc: true
---

The terminal embedded in the hero section is fully extensible. You can add text commands, canvas games, or any interactive program in a few minutes.

## Architecture overview

```
assets/js/
├── modules/
│   └── hero-terminal.js        ← Terminal engine (ctx API)
└── terminal-commands/
    ├── help.js                 ← Auto-built from registry
    ├── system.js               ← clear / cls
    ├── color.js                ← color command
    ├── fun.js                  ← matrix, sl, hack, fortune, cowsay, ls/open…
    ├── pong.js                 ← Game (ctx.createGame)
    ├── pacman.js               ← Game (ctx.createGame)
    ├── snake.js                ← Game (ctx.createGame)
    ├── tetris.js               ← Game (ctx.createGame)
    ├── 2048.js                 ← Game (ctx.createGame)
    └── gba.js                  ← Game Boy Advance emulator (gpSP, WebAssembly)
```

Every command file calls `window.Terminal.register()` and is loaded via a `<script>` tag in `_layouts/default.html`.

---

## Step 1 — Create the command file

Create `assets/js/terminal-commands/my-command.js`:

```javascript
window.Terminal.register({
  name:    'hello',
  aliases: ['hi'],
  help:    ['hello [name]', 'Say hello'],
  run: function(args, ctx) {
    var name = args[0] || 'world';
    ctx.printLine('Hello, ' + name + '!', 'term-out-bold');
  }
});
```

---

## Step 2 — Register it in default.html

Open `_layouts/default.html` and add a script tag next to the other command scripts — inside the `{% raw %}{% if load_terminal %}{% endraw %}` block, so it is only loaded on pages that have a terminal:

```html
<script src="/assets/js/terminal-commands/my-command.js" defer></script>
```

That's it. Rebuild Jekyll and type `hello` in the terminal.

---

## The `ctx` API

The `ctx` object is passed to every command's `run` function.

| Method / Property | Description |
|---|---|
| `ctx.printLine(text, cssClass, delayMs)` | Print a line of text |
| `ctx.printLines(array, cssClass, baseDelay)` | Print multiple lines |
| `ctx.clearOutput()` | Clear the terminal |
| `ctx.hideOutput()` | Hide output + input (for games) |
| `ctx.showOutput()` | Restore output + input |
| `ctx.createGame(spec)` | Run a canvas game on the shared engine (see below) |
| `ctx.stopGame()` | Stop the running game, restore terminal |
| `ctx.canvas` | The `<canvas>` element |
| `ctx.history()` | Copy of the command history (newest first) |
| `ctx.neofetch()` | Print the boot banner again |
| `ctx.getGameDimensions()` | *Legacy* — returns `{W, H}`, usable canvas size |
| `ctx.resizeForGame(W, H)` | *Legacy* — resize terminal to fit a game, returns Promise |
| `ctx.getAccentColor()` | Returns `{r, g, b}` — current user/theme accent |
| `ctx.isFullscreen()` | `true` if terminal is in fullscreen mode |
| `ctx.gameLoop.set(handle)` | Set rAF handle |
| `ctx.isTouch()` | `true` on touch devices (phones, tablets) |
| `ctx.isPhone()` | `true` on phones (small touch screen) |

Outside of commands, `window.Terminal.open()` and `window.Terminal.close()` open or close the terminal (e.g. from a button elsewhere on the page).

### CSS classes for `printLine`

| Class | Appearance |
|---|---|
| `term-out` | Default accent color |
| `term-out-bold` | Bright accent, bold |
| `term-out-dim` | Dimmed accent |
| `term-out-error` | Red |
| `term-out-warn` | Yellow |
| `term-out-info` | Light blue |
| `term-out-ascii` | Small, dimmed — for ASCII art |

---

## Text commands

```javascript
window.Terminal.register({
  name: 'uptime',
  help: ['uptime', 'Show page uptime'],
  run: function(args, ctx) {
    var s = Math.floor(performance.now() / 1000);
    ctx.printLine('up ' + Math.floor(s/60) + 'm ' + (s%60) + 's', 'term-out');
  }
});
```

---

## Canvas games

### `ctx.createGame(spec)` — the shared game engine

Every built-in game runs on `ctx.createGame`. You describe the game at a fixed
**logical resolution** and draw in those units; the engine takes care of the rest:

- **same window for every game** — sized to the viewport and the hero frame,
  the whole window in fullscreen, the whole screen on phones. The game is
  scaled to fit, centred (letterboxed) and sharp on HiDPI screens;
- **fixed 60 Hz update** whatever the monitor refresh rate (a 144 Hz screen no longer runs games 2.4× faster), one render per frame;
- **P** pause (also when the tab is hidden), **R / Enter** replay after game over,
  **Esc / Ctrl+C** quit, best score saved per game, live resize and fullscreen switch;
- every listener is removed on exit.

```javascript
window.Terminal.register({
  name: 'dodge',
  help: ['dodge', 'Dodge the blocks  (← →)', 'games'],
  touch: { drag: true },                     // phones: finger drag → onPointer
  run: function(args, ctx) {
    ctx.createGame({
      name: 'dodge', title: '🟦 DODGE', controls: '← → or mouse',
      width: 600, height: 400,               // logical size: draw in these units
      keys: ['ArrowLeft', 'ArrowRight'],     // keys the page must not scroll with

      init: function(g) {                    // also called on replay (R)
        g.data.x = 300; g.data.rocks = []; g.data.spawn = 0;
      },
      onPointer: function(g, x) { g.data.x = x; },
      update: function(g, dt) {              // dt = 1/60 s, fixed
        var d = g.data;
        if (g.keys.ArrowLeft)  d.x -= 320 * dt;
        if (g.keys.ArrowRight) d.x += 320 * dt;
        d.x = Math.max(15, Math.min(g.W - 15, d.x));
        if ((d.spawn -= dt) <= 0) { d.spawn = 0.5; d.rocks.push({ x: Math.random() * g.W, y: -20 }); }
        d.rocks.forEach(function(r) { r.y += 220 * dt; });
        d.rocks = d.rocks.filter(function(r) { return r.y < g.H + 20; });
        if (d.rocks.some(function(r) { return Math.abs(r.x - d.x) < 25 && Math.abs(r.y - (g.H - 30)) < 20; })) g.end('SPLAT');
        g.score = Math.floor(g.t * 10);
      },
      render: function(c, g) {
        // static background drawn once, re-drawn only when the theme/accent changes
        c.drawImage(g.layer('bg', function(l) {
          l.fillStyle = g.light() ? '#f0f4fc' : '#050a12'; l.fillRect(0, 0, g.W, g.H);
        }, g.light()), 0, 0, g.W, g.H);
        c.fillStyle = g.color(1);                              // current accent colour
        c.fillRect(g.data.x - 15, g.H - 40, 30, 20);
        c.fillStyle = '#f85149';
        g.data.rocks.forEach(function(r) { c.fillRect(r.x - 10, r.y - 10, 20, 20); });
        c.fillText('SCORE ' + g.score + '  BEST ' + g.best, 10, 20);
      }
    });
  }
});
```

| `spec` field | |
|---|---|
| `name`, `title`, `controls` | Best-score key, start line printed in the terminal |
| `width`, `height` | Logical resolution |
| `keys` | Keys the game uses (their default action is prevented) |
| `init(g)` | Set up `g.data`; called again on replay |
| `update(g, dt)` | Game logic, `dt` = 1/60 s |
| `render(c, g)` | Draw with the 2D context `c`, in logical units |
| `onKey(g, key, down, e)` | Optional, key presses/releases (`g.keys[key]` also tracks held keys) |
| `onPointer(g, x, y)` | Optional, mouse / finger position in logical units |
| `exit(g)` | Optional, called when the game is closed |

| `g` | |
|---|---|
| `g.W`, `g.H`, `g.t` | Logical size, game time in seconds |
| `g.score`, `g.best` | Current / best score |
| `g.data` | Your state (reset on replay) |
| `g.keys` | Keys currently held |
| `g.end(msg, won)` | Game over (or win) overlay, saves the best score |
| `g.color(alpha)`, `g.accent()`, `g.light()` | Accent colour as `rgba()`, `{r,g,b}`, light theme? |
| `g.layer(id, drawFn, deps)` | Cached offscreen drawing, redrawn when `deps` or the scale change |

Tips: avoid `shadowBlur` on many shapes per frame (it is the most expensive
canvas operation) and put everything static in a `g.layer`.

The older pattern (`ctx.resizeForGame` + your own `requestAnimationFrame` loop
and `ctx.gameLoop.set`) still works for existing games.

---

## Adding to `/help`

The `help` array:

```javascript
help: ['command syntax', 'Description']          // regular command
help: ['command syntax', 'Description', 'games'] // listed under Games section
```

### Touch controls for games

On phones and tablets, the terminal translates gestures on the game canvas into the key events your game already listens to, so a keyboard game works on touch screens without extra code:

- **swipe** → `ArrowLeft` / `ArrowRight` / `ArrowUp` / `ArrowDown`
- **tap** → the key named in `touch.tap` (nothing by default)
- **drag** (with `touch.drag: true`) → `mousemove` events instead of swipes, for pointer-driven games

An on-screen **quit** button replaces the `Esc` key.

```javascript
window.Terminal.register({
  name: 'tetris',
  help: ['tetris', 'Play Tetris', 'games'],
  touch: { tap: 'ArrowUp' },   // tap = rotate
  run: function(args, ctx) { /* … */ }
});
```

---

## Customizing the neofetch boot screen

Edit `_config.yml`:

```yaml
theme_config:
  terminal_user: "user@infops"   # header label
  terminal_boot:
    user:  "loup"
    host:  "infops"
    os:    "AlmaLinux 10"
    shell: "bash 5.2"
    role:  "SysOps"
    line1: "Org: My Company"
    line2: "Stack: Docker · Proxmox"
    motd:  "Type /help for commands."
    ascii: |
      ██╗███╗   ██╗███████╗
      ██║████╗  ██║██╔════╝
      ██║██╔██╗ ██║█████╗
      ██║██║╚██╗██║██╔══╝
      ██║██║ ╚████║██║
      ╚═╝╚═╝  ╚═══╝╚═╝
```

Leave any field as `""` to hide that line. Leave `ascii` empty to use the default Ubuntu-style logo.

To show your **logo image** instead of the ASCII art, set `image` (same-origin or `https://` URLs only):

```yaml
  terminal_boot:
    image:     "/assets/images/logo.png"
    image_alt: "My logo"
```

---

## Terminal behaviour options

```yaml
theme_config:
  terminal:
    mobile:            "button"   # phones: button (opens on tap) | show | hide
    launcher_label:    "Open terminal"
    autofocus:         true       # desktop only — never on touch devices
    persist_history:   true       # ↑/↓ history kept for the browser tab
    welcome_command:   "help"     # command run right after boot ("" = none)
    disabled_commands: [matrix]   # hidden from /help and not runnable
    max_input:         256        # max characters per command
    max_lines:         500        # output lines kept in the DOM
```

- **Phones**: with `mobile: "button"` the terminal is not shown at page load; an *Open terminal* button opens it full screen, sized to the visible area so the on-screen keyboard never hides the prompt.
- **Desktop**: double-click the title bar to toggle fullscreen. Closing the terminal (red dot or `exit`) leaves the *Open terminal* button to bring it back.
- **Shortcuts**: `Tab` autocomplete · `↑/↓` history · `Ctrl+L` clear · `Ctrl+C` stop · `Esc` quit game / fullscreen · `P` pause · `R` replay.
