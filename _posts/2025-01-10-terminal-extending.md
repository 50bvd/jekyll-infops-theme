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
    ├── fun.js                  ← matrix
    ├── pong.js                 ← Canvas game
    ├── pacman.js               ← Canvas game
    ├── snake.js                ← Canvas game
    └── tetris.js               ← Canvas game
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

Open `_layouts/default.html` and add a script tag **after** `hero-terminal.js`:

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
| `ctx.stopGame()` | Stop canvas loop, restore terminal |
| `ctx.canvas` | The `<canvas>` element |
| `ctx.getGameDimensions()` | Returns `{W, H}` — usable canvas size |
| `ctx.resizeForGame(W, H)` | Resize terminal to fit game, returns Promise |
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

### Pattern: resizeForGame + getAccentColor

```javascript
(function() {
  var keyH = null;
  function cleanup(ctx) {
    if (keyH) document.removeEventListener('keydown', keyH);
    keyH = null;
    ctx.stopGame();
  }

  window.Terminal.register({
    name: 'mygame',
    help: ['mygame', 'My canvas game', 'games'],
    run: function(args, ctx) {
      ctx.stopGame(); ctx.hideOutput();

      // Compute desired size from viewport
      var W = Math.min(window.innerWidth - 40, 800);
      var H = Math.min(window.innerHeight - 140, 500);

      ctx.resizeForGame(W, H).then(function() {
        var canvas = ctx.canvas; if (!canvas) return;
        var dim = ctx.getGameDimensions();
        W = dim.W; H = dim.H;
        canvas.style.display = 'block'; canvas.style.height = H + 'px';
        canvas.width = W; canvas.height = H;

        var c = canvas.getContext('2d');
        var x = W/2, y = H/2;

        keyH = function(e) {
          if (e.key === 'Escape') { cleanup(ctx); return; }
          if (e.key === 'ArrowLeft')  x -= 8;
          if (e.key === 'ArrowRight') x += 8;
          if (e.key === 'ArrowUp')    y -= 8;
          if (e.key === 'ArrowDown')  y += 8;
        };
        document.addEventListener('keydown', keyH);
        ctx.printLine('Arrow keys · ESC to quit', 'term-out-bold');

        function loop() {
          // Read accent color every frame — changes instantly with color command
          var ac = ctx.getAccentColor();
          var light = document.documentElement.getAttribute('data-theme') === 'light';

          c.fillStyle = light ? '#f0f4fc' : '#070d18';
          c.fillRect(0, 0, W, H);

          var color = 'rgba('+ac.r+','+ac.g+','+ac.b+',.9)';
          c.beginPath(); c.arc(x, y, 20, 0, Math.PI * 2);
          c.fillStyle = color; c.shadowColor = color; c.shadowBlur = 12;
          c.fill(); c.shadowBlur = 0;

          ctx.gameLoop.set(requestAnimationFrame(loop));
        }
        loop();
      });
    }
  });
})();
```

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
- **Shortcuts**: `Tab` autocomplete · `↑/↓` history · `Ctrl+L` clear · `Ctrl+C` stop · `Esc` quit game / fullscreen.
