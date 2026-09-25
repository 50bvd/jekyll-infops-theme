/**
 * terminal-commands/help.js
 * Builds the help table from the registry. Supports /help and help.
 */
window.Terminal.register({
  name:    'help',
  aliases: ['?'],
  help:    ['help', 'Show this help'],
  run: function(args, ctx) {
    var cmds = window.Terminal.commands;
    var seen = [], regular = [], games = [];

    Object.keys(cmds).sort().forEach(function(k) {
      var def = cmds[k];
      if (seen.indexOf(def) !== -1 || !def.help) return;
      seen.push(def);
      if (def.help[2] === 'games') games.push(def.help);
      else regular.push(def.help);
    });
    function byLabel(a, b) { return a[0].localeCompare(b[0]); }
    regular.sort(byLabel); games.sort(byLabel);

    // Fixed column widths — must match the border characters exactly
    var C1 = 20;  // command column (inner)
    var C2 = 40;  // description column (inner)
    var W  = C1 + C2 + 1;  // full-width row: both columns + the middle separator

    function pad(s, n) {
      var out = s || '';
      while (out.length < n) out += ' ';
      return out.slice(0, n);
    }
    function repeat(c, n) { var s=''; for(var i=0;i<n;i++) s+=c; return s; }

    var top  = '┌' + repeat('─', C1) + '┬' + repeat('─', C2) + '┐';
    var mid  = '├' + repeat('─', C1) + '┼' + repeat('─', C2) + '┤';
    var divL = '├' + repeat('─', W)  + '┤';
    var bot  = '└' + repeat('─', C1) + '┴' + repeat('─', C2) + '┘';

    function row(a, b) {
      return '│' + pad(' ' + (a||''), C1) + '│' + pad(' ' + (b||''), C2) + '│';
    }
    function fullRow(text) {
      return '│' + pad(' ' + text, W) + '│';
    }

    // Narrow screens (phones): compact two-line entries instead of the box table
    var out = document.getElementById('terminal-output');
    var narrow = (ctx.isPhone && ctx.isPhone()) || (out && out.clientWidth && out.clientWidth < 520);
    if (narrow) {
      var compact = ['Available commands', ''];
      regular.forEach(function(r) { compact.push('  ' + r[0], '      ' + r[1]); });
      if (games.length) {
        compact.push('', 'Games', '');
        games.forEach(function(r) { compact.push('  ' + r[0], '      ' + r[1]); });
      }
      ctx.printLines(compact, 'term-out');
      return;
    }

    var lines = [
      top,
      fullRow('InfOps Terminal  ·  available commands'),
      mid,
    ];

    regular.forEach(function(r) { lines.push(row(r[0], r[1])); });

    if (games.length) {
      lines.push(divL);
      lines.push(fullRow('Games'));
      lines.push(divL);
      games.forEach(function(r) { lines.push(row(r[0], r[1])); });
    }

    lines.push(bot);
    ctx.printLines(lines, 'term-out-ascii');
  }
});
