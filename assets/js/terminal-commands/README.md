# Terminal Commands

Each file registers one or more commands via `window.Terminal.register()`.

## Active commands

| File | Commands |
|---|---|
| `help.js` | `help`, `?` — auto-builds table from registry |
| `system.js` | `clear`, `cls` |
| `color.js` | `color <name\|#hex\|reset>` |
| `fun.js` | `matrix`, `sl`, `hack`, `fortune`, `cowsay`, `joke`, `8ball`, `flip`, `roll`, `rps`, `sudo`, `neofetch`, `whoami`, `date`, `uptime`, `echo`, `history`, `theme`, `ls`, `open` |
| `pong.js` | 🏓 Pong |
| `pacman.js` | 🟡 Pac-Man |
| `snake.js` | 🐍 Snake |
| `tetris.js` | 🧱 Tetris |
| `2048.js` | 🔢 2048 |

Games run on the shared engine `ctx.createGame()` (same window size for every
game, scaled in fullscreen, fixed 60 Hz update, pause / replay / best score).

## Built-in shortcuts

`Tab` autocomplete · `↑/↓` history · `Ctrl+C` stop · `Ctrl+L` clear · `Esc` quit game / fullscreen · in games: `P` pause, `R` replay

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
`window.Terminal` is defined on every page, so command files can safely be loaded site-wide.
