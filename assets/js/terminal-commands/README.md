# Terminal Commands

Each file registers one or more commands via `window.Terminal.register()`.

## Active commands

| File | Commands |
|---|---|
| `help.js` | `help`, `?` — auto-builds table from registry |
| `system.js` | `clear`, `cls` |
| `color.js` | `color <name\|#hex\|reset>` |
| `fun.js` | `matrix` |
| `pong.js` | 🎮 Pong |
| `pacman.js` | 🎮 Pac-Man |
| `snake.js` | 🐍 Snake |
| `tetris.js` | 🎮 Tetris |

## Adding a command

See `_posts/2025-01-10-terminal-extending.md` for the full guide and `ctx` API reference.

Quick example:

```js
window.Terminal.register({
  name: 'hello',
  aliases: ['hi'],
  help:   ['hello [name]', 'Say hello'],
  run: function(args, ctx) {
    ctx.printLine('Hello, ' + (args[0] || 'world') + '!', 'term-out-bold');
  }
});
```

Load it in `_layouts/default.html` after `hero-terminal.js`, then type `hello` in the terminal.
