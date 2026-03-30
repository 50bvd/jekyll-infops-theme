window.Terminal.register({
  name:    'color',
  aliases: ['colour'],
  help:    ['color <name|#hex>', 'Change terminal accent color'],
  run: function(args, ctx) {
    var presets = {
      'green':  '56D364', 'blue':   '58A6FF', 'purple': 'A855F7',
      'orange': 'F97316', 'red':    'F85149', 'cyan':   '39C5CF',
      'yellow': 'E3B341', 'pink':   'F472B6', 'white':  'E6EDF3',
    };
    var arg = (args[0] || '').toLowerCase().replace('#','');

    if (!arg || arg === 'help') {
      ctx.printLine('Usage: color <name|#RRGGBB|reset>', 'term-out-warn');
      ctx.printLine('Names: green  blue  purple  orange  red  cyan  yellow  pink  white  reset', 'term-out-dim');
      return;
    }

    if (arg === 'reset') {
      if (typeof window.TerminalApplyColor === 'function') window.TerminalApplyColor(null);
      ctx.printLine('Color reset to theme default.', 'term-out-bold');
      return;
    }

    var hex = presets[arg] || (arg.match(/^[0-9a-f]{6}$/i) ? arg : null);
    if (!hex) {
      ctx.printLine("Unknown color. Try: color blue  or  color #FF6B35  or  color reset", 'term-out-error');
      return;
    }

    if (typeof window.TerminalApplyColor === 'function') window.TerminalApplyColor(hex);
    ctx.printLine('Color → #' + hex.toUpperCase(), 'term-out-bold');
  }
});
