/**
 * modules/hero-terminal.js — Terminal engine (registry + ctx API)
 *
 * Public API (unchanged, see _posts/2025-01-10-terminal-extending.md):
 *   window.Terminal.register({ name, aliases, help, run(args, ctx) })
 *   window.Terminal.commands
 *   window.Terminal.ctx
 *
 * The registry is ALWAYS defined, even on pages without the hero terminal,
 * so command files loaded site-wide never throw "window.Terminal is undefined".
 */
'use strict';
(function() {

  var input    = document.getElementById('terminal-input');
  var output   = document.getElementById('terminal-output');
  var canvas   = document.getElementById('term-game-canvas');
  var inputRow = document.getElementById('terminal-input-row');
  var win      = document.getElementById('hero-terminal');
  var overlay  = document.getElementById('term-fs-overlay');
  var mirror   = document.getElementById('terminal-typed-text');
  var area     = document.getElementById('terminal-input-area');

  var STORAGE_COLOR = 'infops-term-color';
  var RGB_RE        = /^\d{1,3},\d{1,3},\d{1,3}$/;
  var HEX_RE        = /^[0-9a-f]{6}$/i;

  var history    = [];
  var histIdx    = -1;
  var _gameLoop  = null;
  var _isFs      = false;
  var _fsPlaceholder = null;
  var _userColor = null;  // "r,g,b" string or null
  var _gameMode  = false;
  var _savedWinH = '';
  var _savedMaxW = '';

  // ── Registry + ctx (public API) ───────────────────────────────────────────
  var commands = {};
  var ctx = {
    printLine:   printLine,
    printLines:  printLines,
    clearOutput: clearOutput,
    stopGame:    stopGame,
    showOutput:  showOutput,
    hideOutput:  hideOutput,
    canvas:      canvas,
    inputRow:    inputRow,
    isFullscreen: function() { return _isFs; },

    // Always current accent {r,g,b} — read every frame in games
    getAccentColor: function() {
      if (_userColor) {
        var p = _userColor.split(',');
        return { r: +p[0], g: +p[1], b: +p[2] };
      }
      return document.documentElement.getAttribute('data-theme') === 'light'
        ? { r: 37,  g: 99,  b: 235 }
        : { r: 88,  g: 166, b: 255 };
    },

    getGameDimensions: function() {
      if (!win) return { W: 600, H: 400 };
      var hdr  = win.querySelector('.terminal-header');
      var hdrH = hdr ? hdr.offsetHeight : 44;
      return { W: win.clientWidth || 600, H: Math.max(200, (win.clientHeight || 400) - hdrH - 4) };
    },

    // Resize terminal to fit the game exactly, returns Promise
    resizeForGame: function(gameW, gameH) {
      return new Promise(function(resolve) {
        if (_isFs || !win) { resolve(); return; }
        if (!_gameMode) {
          _gameMode  = true;
          _savedWinH = win.style.height  || '';
          _savedMaxW = win.style.maxWidth || '';
        }
        var hdr  = win.querySelector('.terminal-header');
        var hdrH = hdr ? hdr.offsetHeight : 44;
        var vpH  = window.innerHeight - 120;
        var vpW  = window.innerWidth  - 40;
        win.style.height   = Math.min(gameH + hdrH + 4, vpH) + 'px';
        win.style.maxWidth = Math.min(gameW, vpW) + 'px';
        win.classList.add('game-mode');
        requestAnimationFrame(function() { requestAnimationFrame(resolve); });
      });
    },

    enterGameMode: function() {
      if (_gameMode || _isFs || !win) return;
      _gameMode  = true;
      _savedWinH = win.style.height  || '';
      _savedMaxW = win.style.maxWidth || '';
      win.style.height   = Math.max(460, Math.min(640, Math.round(window.innerHeight * 0.62))) + 'px';
      win.style.maxWidth = '900px';
      win.classList.add('game-mode');
    },

    exitGameMode: function() { exitGameMode(); },
    gameLoop: { get: function() { return _gameLoop; }, set: function(v) { _gameLoop = v; } }
  };

  window.Terminal = {
    register: function(def) {
      if (!def || !def.name || typeof def.run !== 'function') {
        console.warn('[Terminal] register() needs {name, run}', def);
        return;
      }
      commands[String(def.name).toLowerCase()] = def;
      if (Array.isArray(def.aliases)) def.aliases.forEach(function(a) { commands[String(a).toLowerCase()] = def; });
    },
    get commands() { return commands; },
    ctx: ctx
  };

  // No terminal on this page → keep the registry, skip the UI wiring.
  if (!input || !output) {
    window.heroTerminalClose = window.heroTerminalMin = window.heroTerminalFull = function() {};
    return;
  }

  var canAutoFocus = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  function focusInput() {
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
  }

  // ── Input mirror (visible text + block cursor) ─────────────────────────────
  var typingTimer = null;
  function syncMirror() { if (mirror) mirror.textContent = input.value; }
  input.addEventListener('input', function() {
    syncMirror();
    if (!area) return;
    area.classList.add('is-typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function() { area.classList.remove('is-typing'); }, 500);
  });

  // ── Focus ─────────────────────────────────────────────────────────────────
  if (win) win.addEventListener('click', function(e) {
    if (e.target.closest('.dot') || e.target.closest('.term-game-canvas')) return;
    // Don't steal the focus if the user is selecting output text
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return;
    focusInput();
  });
  if (overlay) overlay.addEventListener('click', exitFullscreen);

  // ── Window controls (buttons + legacy globals) ────────────────────────────
  window.heroTerminalClose = function() { stopGame(); exitFullscreen(); if (win) win.hidden = true; };
  window.heroTerminalMin   = function() { if (!win) return; stopGame(); setStatus(!win.classList.toggle('minimized')); };
  window.heroTerminalFull  = function() { _isFs ? exitFullscreen() : enterFullscreen(); };

  [['dot-close', 'heroTerminalClose'], ['dot-min', 'heroTerminalMin'], ['dot-full', 'heroTerminalFull']]
    .forEach(function(pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.addEventListener('click', function(e) { e.stopPropagation(); window[pair[1]](); });
    });

  // ── Theme change ──────────────────────────────────────────────────────────
  window.addEventListener('themechange', function() {
    if (_userColor) {
      var p = _userColor.split(',');
      win.style.setProperty('--term-color', _userColor);
      applyWindowStyle(+p[0], +p[1], +p[2]);
    } else {
      win.style.removeProperty('--term-color');
      applyWindowStyle(null);
    }
  });

  // ── Keyboard ──────────────────────────────────────────────────────────────
  input.addEventListener('keydown', function(e) {
    if (e.isComposing) return;

    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault(); input.value = ''; histIdx = -1; syncMirror();
      stopGame();
      if (typeof window.TerminalMatrixStop === 'function') window.TerminalMatrixStop(ctx);
      return;
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault(); clearOutput(); return;
    }
    if (e.key === 'Escape') {
      if (_gameLoop) { e.preventDefault(); stopGame(); return; }
      if (_isFs)     { e.preventDefault(); exitFullscreen(); return; }
    }
    if (e.key === 'Tab') {
      e.preventDefault(); autocomplete(); return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; syncMirror(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; input.value = history[histIdx]; }
      else             { histIdx = -1; input.value = ''; }
      syncMirror();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      var raw = input.value.trim(); input.value = ''; histIdx = -1; syncMirror();
      if (!raw) return;
      if (history[0] !== raw) history.unshift(raw);
      if (history.length > 100) history.length = 100;
      printLine('$ ' + raw, 'term-out-dim');
      if (handleEasterEgg(raw)) return;
      runCommand(raw.toLowerCase());
    }
  });

  function autocomplete() {
    var v = input.value.replace(/^\s+/, '');
    if (!v || /\s/.test(v)) return;
    var slash = v.charAt(0) === '/' ? '/' : '';
    var stem  = v.replace(/^\//, '').toLowerCase();
    var hits  = Object.keys(commands).filter(function(k) { return k.indexOf(stem) === 0; }).sort();
    // Aliases of a single command (color / colour) → complete to the first one
    var sameDef = hits.every(function(k) { return commands[k] === commands[hits[0]]; });
    if (hits.length > 1 && sameDef) hits = [hits[0]];
    if (hits.length === 1) {
      input.value = slash + hits[0] + ' '; syncMirror();
    } else if (hits.length > 1) {
      printLine('$ ' + v, 'term-out-dim');
      printLine(hits.join('   '), 'term-out');
    }
  }

  function handleEasterEgg(raw) {
    var m = raw.match(/^setcolor\s+#?([0-9a-fA-F]{6})$/i);
    if (!m) return false;
    applyColor(m[1]);
    printLine('Color → #' + m[1].toUpperCase(), 'term-out-bold');
    return true;
  }

  // ── applyColor ────────────────────────────────────────────────────────────
  function applyColor(hex) {
    if (hex === null) {
      _userColor = null;
      win.style.removeProperty('--term-color');
      applyWindowStyle(null);
      try { sessionStorage.removeItem(STORAGE_COLOR); } catch (e) {}
      return;
    }
    hex = String(hex).replace('#', '');
    if (!HEX_RE.test(hex)) return;
    var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    _userColor = r + ',' + g + ',' + b;
    win.style.setProperty('--term-color', _userColor);
    applyWindowStyle(r, g, b);
    try { sessionStorage.setItem(STORAGE_COLOR, _userColor); } catch (e) {}
  }

  // ── applyWindowStyle ──────────────────────────────────────────────────────
  function applyWindowStyle(r, g, b) {
    var header = win.querySelector('.terminal-header');
    var old = document.getElementById('term-custom-sweep');
    if (old) old.parentNode.removeChild(old);

    if (r === null) {
      ['background', 'border-color', 'box-shadow'].forEach(function(p) { win.style.removeProperty(p); });
      if (header) { header.style.removeProperty('background'); header.style.removeProperty('border-bottom-color'); }
      return;
    }
    function rgba(a) { return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (!isLight) {
      var bg = [Math.round(r * .05 + 7 * .95), Math.round(g * .05 + 13 * .95), Math.round(b * .05 + 24 * .95)];
      var hd = [Math.round(r * .08 + 10 * .92), Math.round(g * .08 + 22 * .92), Math.round(b * .08 + 40 * .92)];
      win.style.background  = 'rgb(' + bg.join(',') + ')';
      win.style.borderColor = rgba(.22);
      win.style.boxShadow   = '0 0 0 1px ' + rgba(.08) + ', 0 30px 60px rgba(0,0,0,.55), 0 0 80px ' + rgba(.08);
      if (header) { header.style.background = 'rgb(' + hd.join(',') + ')'; header.style.borderBottomColor = rgba(.12); }
    } else {
      var lb = [Math.min(255, Math.round(242 + r * .05)), Math.min(255, Math.round(246 + g * .04)), Math.min(255, Math.round(254 + b * .01))];
      var lh = [Math.min(255, Math.round(232 + r * .09)), Math.min(255, Math.round(240 + g * .06)), Math.min(255, Math.round(254 + b * .02))];
      win.style.background  = 'rgb(' + lb.join(',') + ')';
      win.style.borderColor = rgba(.22);
      win.style.boxShadow   = '0 0 0 1px ' + rgba(.12) + ', 0 12px 32px ' + rgba(.12) + ', 0 4px 16px rgba(0,0,0,.07)';
      if (header) { header.style.background = 'rgb(' + lh.join(',') + ')'; header.style.borderBottomColor = rgba(.18); }
    }
    var style = document.createElement('style'); style.id = 'term-custom-sweep';
    style.textContent =
      '#hero-terminal::before{background:repeating-linear-gradient(0deg,transparent,transparent 2px,' + rgba(.025) + ' 2px,' + rgba(.025) + ' 4px) !important;}' +
      '#hero-terminal::after{background:linear-gradient(to bottom,transparent 45%,' + rgba(.035) + ' 48%,' + rgba(.07) + ' 50%,' + rgba(.035) + ' 52%,transparent 55%) !important;}';
    document.head.appendChild(style);
  }

  window.TerminalApplyColor = applyColor;

  // ── Print ─────────────────────────────────────────────────────────────────
  var MAX_LINES = 500;   // keeps the DOM small (e.g. long `matrix` sessions)
  function printLine(text, cls, delay) {
    setTimeout(function() {
      var line = document.createElement('div');
      line.className = 'terminal-line ' + (cls || 'term-out');
      line.textContent = text;
      output.appendChild(line);
      while (output.childElementCount > MAX_LINES) output.removeChild(output.firstElementChild);
      output.scrollTop = output.scrollHeight;
    }, delay || 0);
  }
  function printLines(arr, cls, base) { arr.forEach(function(l, i) { printLine(l, cls || 'term-out', (base || 0) + i * 55); }); }
  function clearOutput() { output.textContent = ''; }
  function hideOutput()  { output.style.display = 'none'; if (inputRow) inputRow.style.display = 'none'; }
  function showOutput()  { output.style.removeProperty('display'); if (inputRow) inputRow.style.removeProperty('display'); }

  function setStatus(connected) {
    var txt = document.getElementById('term-status-text');
    var dot = win.querySelector('.pulse-dot');
    if (txt) txt.textContent = connected ? 'connected' : 'disconnected';
    if (dot) dot.style.background = connected ? '' : '#f85149';
  }

  // ── Fullscreen ────────────────────────────────────────────────────────────
  function updateNavH() {
    var nav = document.querySelector('.main-header');
    if (nav) document.documentElement.style.setProperty('--navbar-h', nav.offsetHeight + 'px');
  }

  function enterFullscreen() {
    if (_isFs) return;
    exitGameMode(); _isFs = true;
    updateNavH();
    _fsPlaceholder = document.createElement('div');
    _fsPlaceholder.className = 'term-fs-placeholder';
    _fsPlaceholder.style.height = win.offsetHeight + 'px';
    win.parentNode.insertBefore(_fsPlaceholder, win);
    document.body.appendChild(win);
    win.classList.add('fullscreen'); document.body.classList.add('term-fullscreen');
    if (overlay) overlay.classList.add('active');
    _setFsIcon(true); setTimeout(focusInput, 50);
  }

  function exitFullscreen() {
    if (!_isFs) return;
    _isFs = false; win.classList.remove('fullscreen'); document.body.classList.remove('term-fullscreen');
    if (_fsPlaceholder && _fsPlaceholder.parentNode) {
      _fsPlaceholder.parentNode.insertBefore(win, _fsPlaceholder);
      _fsPlaceholder.parentNode.removeChild(_fsPlaceholder);
    }
    _fsPlaceholder = null;
    if (overlay) overlay.classList.remove('active');
    _setFsIcon(false); setTimeout(focusInput, 50);
  }

  function _setFsIcon(fs) {
    var ic = document.getElementById('dot-full-icon'), dt = document.getElementById('dot-full');
    if (!ic) return;
    ic.innerHTML = fs
      ? '<polyline points="4,1 1,1 1,4"/><polyline points="9,4 9,1 6,1"/><polyline points="6,9 9,9 9,6"/><polyline points="1,6 1,9 4,9"/>'
      : '<polyline points="1,4 1,1 4,1"/><polyline points="6,1 9,1 9,4"/><polyline points="9,6 9,9 6,9"/><polyline points="4,9 1,9 1,6"/>';
    if (dt) {
      dt.title = fs ? 'Exit fullscreen' : 'Fullscreen';
      dt.setAttribute('aria-label', dt.title);
    }
  }

  // ── Games ─────────────────────────────────────────────────────────────────
  function exitGameMode() {
    if (!_gameMode) return;
    _gameMode = false;
    win.style.height   = _savedWinH;
    win.style.maxWidth = _savedMaxW;
    win.classList.remove('game-mode');
    _savedWinH = _savedMaxW = '';
  }

  function stopGame() {
    if (_gameLoop) { cancelAnimationFrame(_gameLoop); _gameLoop = null; }
    if (canvas) canvas.style.display = 'none';
    exitGameMode(); showOutput();
    setTimeout(focusInput, 50);
  }

  // Games: keep arrow keys / space from scrolling the page while playing
  document.addEventListener('keydown', function(e) {
    if (!_gameLoop) return;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) !== -1) e.preventDefault();
  }, { capture: true });

  // ── Command dispatch ──────────────────────────────────────────────────────
  function runCommand(raw) {
    var parts = raw.split(/\s+/), name = parts[0].replace(/^\//, ''), args = parts.slice(1);
    if (name === 'exit' || name === 'quit') {
      printLine('logout', 'term-out-dim');
      setTimeout(function() { window.heroTerminalClose(); }, 400);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(commands, name)) {
      try { commands[name].run(args, ctx); }
      catch (err) {
        console.error('[Terminal] ' + name + ':', err);
        printLine(name + ': internal error (see console)', 'term-out-error');
        stopGame();
      }
      return;
    }
    printLine('-bash: ' + parts[0] + ': command not found', 'term-out-error');
    printLine('Type /help for available commands.', 'term-out-dim');
  }

  function metaVal(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? (el.getAttribute('content') || '') : '';
  }

  // ── Boot — neofetch with configurable ASCII art ───────────────────────────
  function boot() {
    // Restore saved color (validated: it ends up in a CSS custom property)
    try {
      var saved = sessionStorage.getItem(STORAGE_COLOR);
      if (saved && RGB_RE.test(saved)) {
        var sp = saved.split(',').map(Number);
        if (sp.every(function(n) { return n <= 255; })) {
          _userColor = saved;
          win.style.setProperty('--term-color', saved);
          applyWindowStyle(sp[0], sp[1], sp[2]);
        }
      }
    } catch (e) {}

    var user  = metaVal('term-boot-user')  || 'YOUR_USER';
    var host  = metaVal('term-boot-host')  || 'YOUR_HOST';
    var os    = metaVal('term-boot-os')    || 'YOUR_OS';
    var shell = metaVal('term-boot-shell') || 'YOUR_SHELL';
    var role  = metaVal('term-boot-role')  || 'YOUR_ROLE';
    var line1 = metaVal('term-boot-line1');
    var line2 = metaVal('term-boot-line2');
    var motd  = metaVal('term-boot-motd')  || 'Type /help for all commands.';
    var posts = metaVal('term-boot-posts') || '?';

    var s = Math.floor(performance.now() / 1000);
    var uptime = s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm ' + (s % 60) + 's' : Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';

    var id  = user + '@' + host;
    var bar = new Array(Math.min(id.length, 30) + 1).join('─');

    var info = [id, bar,
      'OS:     ' + os,
      'Shell:  ' + shell,
      'Uptime: ' + uptime,
      'Posts:  ' + posts
    ];
    if (role && role !== 'YOUR_ROLE') info.push('Role:   ' + role);
    if (line1) info.push(line1);
    if (line2) info.push(line2);

    // ASCII art: custom from config or default logo
    var customAscii = metaVal('term-boot-ascii');
    var logo;
    if (customAscii && customAscii.indexOf('YOUR_ASCII') === -1 && customAscii.trim() !== '') {
      logo = customAscii.split('\n');
      while (logo.length < 3) logo.push('');
    } else {
      logo = [
        '     _______      ',
        '    |.-----.|     ',
        '    ||x . x||     ',
        '    ||_.-._||     ',
        '    `--)-(--`     ',
        '   __[=== o]___   ',
        '  |:::::::::::|\\  ',
        '  `-=========-`() '
      ];
    }

    var PAD = Math.max.apply(null, logo.map(function(l) { return l.length; })) + 2;
    function pad(str, n) { var o = str || ''; while (o.length < n) o += ' '; return o.slice(0, n); }

    var rows = Math.max(logo.length, info.length);
    for (var i = 0; i < rows; i++) printLine(pad(logo[i] || '', PAD) + (info[i] || ''), 'term-out-ascii');

    printLine('', 'term-out-dim');
    printLine('  ' + motd, 'term-out-bold');
    printLine('', 'term-out-dim');
    if (canAutoFocus) setTimeout(focusInput, 150);
  }

  window.addEventListener('resize', updateNavH, { passive: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  updateNavH();

})();
