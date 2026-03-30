/**
 * terminal-commands/fun.js
 * Commandes fun: matrix uniquement.
 * Le neofetch est affiché au démarrage via hero-terminal.js.
 */

// ── matrix — ESC ou Ctrl+C pour stopper ─────────────────────────────────
(function() {
  var timer = null, active = false, escHandler = null;

  function stop(ctx) {
    if (!active) return;
    active = false;
    if (timer)      { clearInterval(timer); timer = null; }
    if (escHandler) { document.removeEventListener('keydown', escHandler); escHandler = null; }
    if (ctx) { ctx.printLine('^C — Matrix stopped.', 'term-out-warn'); }
  }

  window.TerminalMatrixStop = stop;

  window.Terminal.register({
    name: 'matrix',
    help: ['matrix', 'Enter the Matrix  (Ctrl+C / ESC to stop)'],
    run: function(args, ctx) {
      if (active) { stop(ctx); return; }
      active = true;
      var body = document.getElementById('terminal-output');
      var fw   = body ? Math.max(30, Math.min(Math.floor(body.clientWidth / 9), 72)) : 54;
      var chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF!@#$%';

      ctx.printLine('[ENTERING THE MATRIX...]', 'term-out-bold');
      ctx.printLine('Ctrl+C or ESC to exit.', 'term-out-dim');

      escHandler = function(e) {
        if (e.key === 'Escape') { e.preventDefault(); stop(ctx); }
      };
      document.addEventListener('keydown', escHandler);

      timer = setInterval(function() {
        if (!active) { clearInterval(timer); timer = null; return; }
        var s = '';
        for (var j = 0; j < fw; j++) s += chars[Math.floor(Math.random() * chars.length)];
        ctx.printLine(s, 'term-out-ascii');
      }, 80);
    }
  });
})();
