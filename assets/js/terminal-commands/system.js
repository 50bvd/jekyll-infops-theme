/**
 * terminal-commands/system.js — Basic terminal utilities
 */
window.Terminal.register({
  name:    'clear',
  aliases: ['cls'],
  help:    ['clear / cls', 'Clear the terminal'],
  run: function(args, ctx) { ctx.clearOutput(); }
});
