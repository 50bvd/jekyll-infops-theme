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
