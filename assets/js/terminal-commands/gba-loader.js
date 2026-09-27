/**
 * terminal-commands/gba-loader.js — registers the `gba` command and loads the
 * emulator frontend (gba.js, ~50 KB) only when it can be needed:
 *   · in the background, once the page has finished loading (skipped when the
 *     visitor asked to save data or is on a 2G connection);
 *   · right away when `gba` is typed or a ROM is dropped on the terminal.
 * The page therefore renders without it, which matters on phones.
 * gba.js is found next to this script: …/js/terminal.bundle.js?v=… (bundled)
 * or …/js/terminal-commands/gba-loader.js?v=… → …/js/terminal-commands/gba.js?v=…
 */
(function() {
  'use strict';
  var me = document.currentScript;
  var m = me && /^(.*\/js\/)(?:terminal\.bundle|terminal-commands\/gba-loader)\.js(\?v=\d+)?$/.exec(me.src || '');
  if (!window.Terminal || !m) return;
  var src = m[1] + 'terminal-commands/gba.js' + (m[2] || '');

  var loading = null;
  function load() {
    if (window.InfopsGBA) return Promise.resolve(window.InfopsGBA);
    if (!loading) {
      loading = new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = function() {
          if (window.InfopsGBA) resolve(window.InfopsGBA);
          else reject(new Error('the emulator did not start'));
        };
        s.onerror = function() {
          loading = null;
          if (s.parentNode) s.parentNode.removeChild(s);
          reject(new Error('cannot download the emulator (' + src.split('?')[0] + ')'));
        };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  window.Terminal.register({
    name: 'gba',
    aliases: ['gameboy'],
    help: ['gba [last|settings]', 'Game Boy Advance emulator', 'games'],
    touch: { none: true },
    run: function(args, ctx) {
      if (window.InfopsGBA) { window.InfopsGBA.run(args, ctx); return; }
      ctx.printLine('gba: loading the emulator…', 'term-out-dim');
      load().then(function(gba) { gba.run(args, ctx); },
                  function(e) { ctx.printLine('gba: ' + e.message, 'term-out-error'); });
    }
  });

  // Drop a .gba / .zip / .sav file on the terminal (works before gba.js is loaded)
  var term = document.getElementById('hero-terminal');
  if (term) {
    var hasFiles = function(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; };
    term.addEventListener('dragover', function(e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      term.classList.add('is-dropping');
      load().catch(function() {});
    });
    term.addEventListener('dragleave', function() { term.classList.remove('is-dropping'); });
    term.addEventListener('drop', function(e) {
      term.classList.remove('is-dropping');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      load().then(function(gba) { gba.openFile(f); }, function(err) {
        window.Terminal.ctx.printLine('gba: ' + err.message, 'term-out-error');
      });
    });
  }

  // Background preload once the page is fully loaded (not on slow / metered links)
  var c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return;
  var later = function() {
    var idle = window.requestIdleCallback || function(fn) { return setTimeout(fn, 1500); };
    idle(function() { load().catch(function() {}); }, { timeout: 5000 });
  };
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });
})();
