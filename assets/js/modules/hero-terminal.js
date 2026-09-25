/**
 * modules/hero-terminal.js — Terminal engine (registry + ctx API)
 *
 * Public API (unchanged, see _posts/2025-01-10-terminal-extending.md):
 *   window.Terminal.register({ name, aliases, help, run(args, ctx), touch? })
 *   window.Terminal.commands
 *   window.Terminal.ctx
 *   window.Terminal.open() / .close()          (new)
 *
 * The registry is ALWAYS defined, even on pages without the hero terminal,
 * so command files loaded site-wide never throw "window.Terminal is undefined".
 *
 * Window management by device:
 *   · desktop : inline window · double-click title bar = fullscreen · close → "Open terminal" launcher
 *   · phone   : hidden at page load (CSS, no flash) → launcher button opens it full-viewport,
 *               sized to the visual viewport so the on-screen keyboard never hides the prompt;
 *               games get swipe / tap / drag controls and an on-screen quit button.
 *   · config  : _config.yml → theme_config.terminal (read from data-* on #terminal-shell)
 */
'use strict';
(function() {

  var shell    = document.getElementById('terminal-shell');
  var launcher = document.getElementById('terminal-launcher');
  var input    = document.getElementById('terminal-input');
  var output   = document.getElementById('terminal-output');
  var canvas   = document.getElementById('term-game-canvas');
  var inputRow = document.getElementById('terminal-input-row');
  var win      = document.getElementById('hero-terminal');
  var overlay  = document.getElementById('term-fs-overlay');
  var mirror   = document.getElementById('terminal-typed-text');
  var area     = document.getElementById('terminal-input-area');
  var gameExit = document.getElementById('term-game-exit');

  var STORAGE_COLOR   = 'infops-term-color';
  var STORAGE_HISTORY = 'infops-term-history';
  var RGB_RE          = /^\d{1,3},\d{1,3},\d{1,3}$/;
  var HEX_RE          = /^[0-9a-f]{6}$/i;
  var CTRL_CHARS_RE   = /[\u0000-\u001f\u007f-\u009f]/g;

  // ── Config (data-* attributes rendered from _config.yml) ─────────────────────
  var cfg = (function() {
    var d = (shell && shell.dataset) || {};
    return {
      mobile:         d.mobile || 'button',                    // button | show | hide
      autofocus:      d.autofocus !== 'false',
      persistHistory: d.persistHistory !== 'false',
      maxInput:       Math.max(16, Math.min(1000, parseInt(d.maxInput || '256', 10) || 256)),
      maxLines:       Math.max(50, Math.min(5000, parseInt(d.maxLines || '500', 10) || 500)),
      welcome:        (d.welcome || '').trim(),
      disabled:       (d.disabled || '').toLowerCase().split(/[\s,]+/).filter(Boolean)
    };
  })();

  var mq = function(q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var phoneMQ = mq('(max-width: 768px) and (pointer: coarse)');
  var isTouch = mq('(pointer: coarse)').matches || ('ontouchstart' in window);
  function isPhone() { return phoneMQ.matches; }

  var history    = [];
  var histIdx    = -1;
  var _gameLoop  = null;
  var _game      = null;    // definition of the command currently running a game
  var _quitting  = false;
  var _isFs      = false;
  var _fsPlaceholder = null;
  var _userColor = null;  // "r,g,b" string or null
  var _gameMode  = false;
  var _savedWinH = '';
  var _savedMaxW = '';
  var _booted    = false;
  var _engine    = null;    // running game created with ctx.createGame()

  // ── Registry + ctx (public API) ───────────────────────────────────────────
  var commands = {};
  function isEnabled(name) { return cfg.disabled.indexOf(name) === -1; }
  function enabledCommands() {
    var out = {};
    Object.keys(commands).forEach(function(k) {
      var def = commands[k];
      if (isEnabled(k) && isEnabled(String(def.name).toLowerCase())) out[k] = def;
    });
    return out;
  }

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
    isTouch:      function() { return isTouch; },
    isPhone:      isPhone,
    createGame:   function(spec) { return createGame(spec); },
    history:      function() { return history.slice(); },
    neofetch:     function() { neofetch(); },

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
    gameLoop: {
      get: function() { return _gameLoop; },
      set: function(v) {
        _gameLoop = v;
        if (win) win.classList.toggle('is-playing', !!v);
      }
    }
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
    get commands() { return enabledCommands(); },
    ctx: ctx,
    open:  function() {},
    close: function() {}
  };

  // No terminal on this page → keep the registry, skip the UI wiring.
  if (!input || !output || !win) {
    window.heroTerminalClose = window.heroTerminalMin = window.heroTerminalFull = function() {};
    return;
  }

  input.maxLength = cfg.maxInput;

  function focusInput() {
    if (win.hidden || (shell && isPhone() && !shell.classList.contains('is-open') && cfg.mobile !== 'show')) return;
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
  }

  // ── Input mirror (visible text + block cursor) ─────────────────────────────
  var typingTimer = null;
  function syncMirror() { if (mirror) mirror.textContent = input.value; }
  input.addEventListener('input', function() {
    // Strip control characters that can sneak in through paste
    if (CTRL_CHARS_RE.test(input.value)) input.value = input.value.replace(CTRL_CHARS_RE, '');
    syncMirror();
    if (!area) return;
    area.classList.add('is-typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function() { area.classList.remove('is-typing'); }, 500);
  });

  // ── Focus ─────────────────────────────────────────────────────────────────
  win.addEventListener('click', function(e) {
    if (e.target.closest('.dot, .term-game-exit, .term-game-canvas')) return;
    // Don't steal the focus if the user is selecting output text
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return;
    focusInput();
  });
  if (overlay) overlay.addEventListener('click', function() { isPhone() ? closeTerminal() : exitFullscreen(); });

  // ── Open / close (launcher) ───────────────────────────────────────────────
  function openTerminal() {
    if (!shell) return;
    shell.classList.remove('is-closed');
    win.hidden = false;
    if (isPhone()) {
      shell.classList.add('is-open');
      enterFullscreen();
    }
    if (!_booted) boot();
    setStatus(true);
    win.classList.remove('minimized');
    setTimeout(focusInput, 60);
  }

  function closeTerminal() {
    stopGame(true);
    exitFullscreen();
    if (shell) {
      shell.classList.remove('is-open');
      shell.classList.add('is-closed');
      if (launcher) setTimeout(function() { try { launcher.focus({ preventScroll: true }); } catch (e) {} }, 60);
    } else {
      win.hidden = true;
    }
  }

  if (launcher) launcher.addEventListener('click', openTerminal);
  window.Terminal.open  = openTerminal;
  window.Terminal.close = closeTerminal;

  // Leaving phone layout (rotation to a large tablet, resized window…) while open
  function onDeviceChange() {
    if (!isPhone() && _isFs && win.classList.contains('is-mobile-fs')) exitFullscreen();
    if (!isPhone() && shell) shell.classList.remove('is-open');
  }
  if (phoneMQ.addEventListener) phoneMQ.addEventListener('change', onDeviceChange);
  else if (phoneMQ.addListener) phoneMQ.addListener(onDeviceChange);

  // ── Window controls (buttons + legacy globals) ────────────────────────────
  window.heroTerminalClose = closeTerminal;
  window.heroTerminalMin   = function() {
    if (isPhone()) { closeTerminal(); return; }
    stopGame(true);
    setStatus(!win.classList.toggle('minimized'));
  };
  window.heroTerminalFull  = function() { _isFs ? exitFullscreen() : enterFullscreen(); };

  [['dot-close', 'heroTerminalClose'], ['dot-min', 'heroTerminalMin'], ['dot-full', 'heroTerminalFull']]
    .forEach(function(pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.addEventListener('click', function(e) { e.stopPropagation(); window[pair[1]](); });
    });

  // Double-click the title bar = toggle fullscreen (desktop)
  var header = win.querySelector('.terminal-header');
  if (header) header.addEventListener('dblclick', function(e) {
    if (e.target.closest('.dot') || isPhone()) return;
    window.heroTerminalFull();
  });

  // ── Theme change ──────────────────────────────────────────────────────────
  window.addEventListener('themechange', function() {
    if (_userColor) {
      var p = _userColor.split(',');
      applyWindowStyle(+p[0], +p[1], +p[2]);
    } else {
      applyWindowStyle(null);
    }
  });

  // ── Keyboard ──────────────────────────────────────────────────────────────
  input.addEventListener('keydown', function(e) {
    if (e.isComposing) return;

    if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      // Keep the native copy when output text is selected
      var sel = window.getSelection && String(window.getSelection());
      if (sel && !input.value) return;
      e.preventDefault(); input.value = ''; histIdx = -1; syncMirror();
      stopGame(true);
      if (typeof window.TerminalMatrixStop === 'function') window.TerminalMatrixStop(ctx);
      return;
    }
    if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault(); clearOutput(); return;
    }
    if (e.key === 'Escape') {
      if (_gameLoop) { e.preventDefault(); stopGame(); return; }
      if (_isFs)     { e.preventDefault(); isPhone() ? closeTerminal() : exitFullscreen(); return; }
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
      submit();
    }
  });

  function submit() {
    var raw = input.value.replace(CTRL_CHARS_RE, '').trim().slice(0, cfg.maxInput);
    input.value = ''; histIdx = -1; syncMirror();
    if (!raw) return;
    if (history[0] !== raw) history.unshift(raw);
    if (history.length > 100) history.length = 100;
    saveHistory();
    printLine('$ ' + raw, 'term-out-dim');
    if (handleEasterEgg(raw)) return;
    runCommand(raw);
  }

  function loadHistory() {
    if (!cfg.persistHistory) return;
    try {
      var h = JSON.parse(sessionStorage.getItem(STORAGE_HISTORY) || '[]');
      if (Array.isArray(h)) history = h.filter(function(x) { return typeof x === 'string'; })
                                       .map(function(x) { return x.replace(CTRL_CHARS_RE, '').slice(0, cfg.maxInput); })
                                       .slice(0, 50);
    } catch (e) { history = []; }
  }
  function saveHistory() {
    if (!cfg.persistHistory) return;
    try { sessionStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 50))); } catch (e) {}
  }

  function autocomplete() {
    var v = input.value.replace(/^\s+/, '');
    if (!v || /\s/.test(v)) return;
    var slash = v.charAt(0) === '/' ? '/' : '';
    var stem  = v.replace(/^\//, '').toLowerCase();
    var cmds  = enabledCommands();
    var hits  = Object.keys(cmds).filter(function(k) { return k.indexOf(stem) === 0; }).sort();
    // Aliases of a single command (color / colour) → complete to the first one
    var sameDef = hits.every(function(k) { return cmds[k] === cmds[hits[0]]; });
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
      applyWindowStyle(null);
      try { sessionStorage.removeItem(STORAGE_COLOR); } catch (e) {}
      return;
    }
    hex = String(hex).replace('#', '');
    if (!HEX_RE.test(hex)) return;
    var r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    _userColor = r + ',' + g + ',' + b;
    applyWindowStyle(r, g, b);
    try { sessionStorage.setItem(STORAGE_COLOR, _userColor); } catch (e) {}
  }

  // ── applyWindowStyle ──────────────────────────────────────────────────────
  // Inline CSSOM properties + a class only: no <style> element is injected,
  // so this keeps working under a strict Content-Security-Policy.
  function applyWindowStyle(r, g, b) {
    if (r === null) {
      win.classList.remove('has-custom-color');
      ['--term-color', 'background', 'border-color', 'box-shadow'].forEach(function(p) { win.style.removeProperty(p); });
      if (header) { header.style.removeProperty('background'); header.style.removeProperty('border-bottom-color'); }
      return;
    }
    function rgba(a) { return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
    win.classList.add('has-custom-color');
    win.style.setProperty('--term-color', r + ',' + g + ',' + b);
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (!isLight) {
      var bg = [Math.round(r * .05 + 7 * .95), Math.round(g * .05 + 13 * .95), Math.round(b * .05 + 24 * .95)];
      var hd = [Math.round(r * .08 + 10 * .92), Math.round(g * .08 + 22 * .92), Math.round(b * .08 + 40 * .92)];
      win.style.background  = 'rgb(' + bg.join(',') + ')';
      win.style.borderColor = rgba(.22);
      win.style.boxShadow   = '0 0 0 1px ' + rgba(.08) + ', 0 30px 60px rgba(0,0,0,.55), 0 0 80px ' + rgba(.08);
      if (header) { header.style.background = 'rgb(' + hd.join(',') + ')'; header.style.borderBottomColor = rgba(.12); }
    } else {
      // soft tinted greys (the light theme is never white)
      var lb = [Math.round(r * .06 + 226 * .94), Math.round(g * .06 + 230 * .94), Math.round(b * .06 + 236 * .94)];
      var lh = [Math.round(r * .1 + 216 * .9), Math.round(g * .1 + 221 * .9), Math.round(b * .1 + 229 * .9)];
      win.style.background  = 'rgb(' + lb.join(',') + ')';
      win.style.borderColor = rgba(.22);
      win.style.boxShadow   = '0 0 0 1px ' + rgba(.12) + ', 0 12px 32px ' + rgba(.12) + ', 0 4px 16px rgba(0,0,0,.07)';
      if (header) { header.style.background = 'rgb(' + lh.join(',') + ')'; header.style.borderBottomColor = rgba(.18); }
    }
  }

  window.TerminalApplyColor = applyColor;

  // ── Print ─────────────────────────────────────────────────────────────────
  // Lines are appended right away (or after `delay` ms); trimming and
  // scrolling happen once per frame however many lines were printed.
  var scrollPending = false;
  function trimOutput() {
    if (scrollPending) return;
    scrollPending = true;
    requestAnimationFrame(function() {
      scrollPending = false;
      while (output.childElementCount > cfg.maxLines) output.removeChild(output.firstElementChild);
      output.scrollTop = output.scrollHeight;
    });
  }
  function appendLine(text, cls) {
    var line = document.createElement('div');
    line.className = 'terminal-line ' + (cls || 'term-out');
    line.textContent = text;
    output.appendChild(line);
    trimOutput();
  }
  function printLine(text, cls, delay) {
    if (delay > 0) setTimeout(function() { appendLine(text, cls); }, delay);
    else appendLine(text, cls);
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

  // Phones: follow the *visual* viewport so the virtual keyboard never covers the prompt
  var vv = window.visualViewport;
  function fitVisualViewport() {
    if (!_isFs || !win.classList.contains('is-mobile-fs') || !vv) return;
    win.style.height = Math.round(vv.height) + 'px';
    win.style.top    = Math.round(vv.offsetTop) + 'px';
    output.scrollTop = output.scrollHeight;
  }
  if (vv) {
    vv.addEventListener('resize', fitVisualViewport);
    vv.addEventListener('scroll', fitVisualViewport);
  }

  function enterFullscreen() {
    if (_isFs) return;
    exitGameMode(); _isFs = true;
    updateNavH();
    _fsPlaceholder = document.createElement('div');
    _fsPlaceholder.className = 'term-fs-placeholder';
    _fsPlaceholder.style.height = (win.offsetHeight || 0) + 'px';
    win.parentNode.insertBefore(_fsPlaceholder, win);
    document.body.appendChild(win);
    win.classList.add('fullscreen');
    if (isPhone()) { win.classList.add('is-mobile-fs'); fitVisualViewport(); }
    document.body.classList.add('term-fullscreen');
    if (overlay) overlay.classList.add('active');
    _setFsIcon(true); setTimeout(focusInput, 50);
    if (_engine) requestAnimationFrame(function() { if (_engine) _engine.layout(); });
  }

  function exitFullscreen() {
    if (!_isFs) return;
    _isFs = false;
    win.classList.remove('fullscreen', 'is-mobile-fs');
    win.style.removeProperty('top');
    if (!_gameMode) win.style.removeProperty('height');
    document.body.classList.remove('term-fullscreen');
    if (_fsPlaceholder && _fsPlaceholder.parentNode) {
      _fsPlaceholder.parentNode.insertBefore(win, _fsPlaceholder);
      _fsPlaceholder.parentNode.removeChild(_fsPlaceholder);
    }
    _fsPlaceholder = null;
    if (overlay) overlay.classList.remove('active');
    _setFsIcon(false); setTimeout(focusInput, 50);
    if (_engine) requestAnimationFrame(function() { if (_engine) _engine.layout(); });
  }

  function _setFsIcon(fs) {
    var ic = document.getElementById('dot-full-icon'), dt = document.getElementById('dot-full');
    if (!ic) return;
    var pts = fs
      ? ['4,1 1,1 1,4', '9,4 9,1 6,1', '6,9 9,9 9,6', '1,6 1,9 4,9']
      : ['1,4 1,1 4,1', '6,1 9,1 9,4', '9,6 9,9 6,9', '4,9 1,9 1,6'];
    while (ic.firstChild) ic.removeChild(ic.firstChild);
    pts.forEach(function(p) {
      var pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('points', p);
      ic.appendChild(pl);
    });
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

  function sendKey(key, type) {
    document.dispatchEvent(new KeyboardEvent(type || 'keydown', { key: key, bubbles: true, cancelable: true }));
  }
  function tapKey(key) {
    sendKey(key, 'keydown');
    setTimeout(function() { sendKey(key, 'keyup'); }, 90);
  }

  // `quit` = true lets the running game clean up its own listeners (it listens
  // for Escape on document) before the terminal tears the canvas down.
  function stopGame(quit) {
    if (_engine) { var eng = _engine; _engine = null; eng.destroy(); }
    if (quit === true && _gameLoop && !_quitting) {
      _quitting = true;
      try { sendKey('Escape'); } finally { _quitting = false; }
    }
    if (_gameLoop) { cancelAnimationFrame(_gameLoop); _gameLoop = null; }
    _game = null;
    win.classList.remove('is-playing');
    if (canvas) canvas.style.display = 'none';
    exitGameMode(); showOutput();
    if (_isFs && win.classList.contains('is-mobile-fs')) fitVisualViewport();
    setTimeout(focusInput, 50);
  }


  // ── Game engine (ctx.createGame) ──────────────────────────────────────────
  // Games describe a fixed LOGICAL resolution (spec.width × spec.height) and
  // draw in those units; the engine:
  //   · gives every game the same window: sized to the viewport and the hero
  //     frame, the whole window in fullscreen — content is scaled to fit and
  //     centred, HiDPI-sharp (devicePixelRatio);
  //   · runs update() at a fixed 60 Hz whatever the monitor refresh rate
  //     (games used to run 2.4× faster on 144 Hz screens), render() once per frame;
  //   · handles pause (P, tab hidden), restart (R / Enter after game over),
  //     quit (Esc), best scores (localStorage), resize and fullscreen live,
  //     and removes every listener on exit.
  //
  // spec = { name, width, height, keys: [...keys the game uses],
  //          init(g), update(g, dt), render(c, g), onKey(g, key, down, e),
  //          onPointer(g, x, y), exit(g),
  //          integerScale: bool | fn → whole-number scaling only,
  //          pauseOverlay: false → no "PAUSED" overlay (the game draws its own UI) }
  // g    = { W, H, t, score, best, over, paused, data, color(a), light(),
  //          end(message, won), restart(), print(text, cls), relayout() }
  var STEP = 1 / 60;

  function gameStage() {
    var hdr  = win.querySelector('.terminal-header');
    var hdrH = hdr ? hdr.offsetHeight : 44;
    if (_isFs) return { w: win.clientWidth, h: Math.max(160, win.clientHeight - hdrH) };
    var docW  = document.documentElement.clientWidth;
    var host  = (_fsPlaceholder && _fsPlaceholder.parentNode) || win.parentNode;
    var hostW = host && host.clientWidth ? host.clientWidth : docW;
    var w = Math.max(280, Math.min(900, docW - 32, Math.max(hostW, 720)));
    var navH = (document.querySelector('.main-header') || {}).offsetHeight || 60;
    var maxH = window.innerHeight - navH - hdrH - 48;
    var h = Math.max(240, Math.min(Math.round(w * 0.62), maxH));
    return { w: w, h: h, hdrH: hdrH };
  }

  function createGame(spec) {
    var def = _game;                   // command being run (touch settings…), reset by stopGame()
    stopGame();
    _game = def;
    hideOutput();
    if (isPhone() && !_isFs) enterFullscreen();

    var c2d = canvas.getContext('2d', { alpha: false });
    var dpr = 1, scale = 1, ox = 0, oy = 0, cssW = 0, cssH = 0;
    var raf = null, last = 0, acc = 0;
    var keys = {};
    var bestKey = 'infops-best-' + spec.name;
    var g = {
      W: spec.width, H: spec.height, t: 0, score: 0, best: 0, over: false, won: false,
      paused: false, message: '', data: {}, keys: keys,
      color: function(a) { var c = ctx.getAccentColor(); return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + (a == null ? 1 : a) + ')'; },
      accent: function() { return ctx.getAccentColor(); },
      light: function() { return document.documentElement.getAttribute('data-theme') === 'light'; },
      print: printLine,
      end: function(msg, won) {
        if (g.over) return;
        g.over = true; g.won = !!won; g.message = msg || (won ? 'YOU WIN' : 'GAME OVER');
        var record = g.score > g.best;
        if (record) { g.best = g.score; try { localStorage.setItem(bestKey, String(g.best)); } catch (e) {} }
        printLine(spec.name.toUpperCase() + ' — ' + g.message + ' · score ' + g.score + (record ? ' · new best!' : ' · best ' + g.best),
          won ? 'term-out-bold' : 'term-out-error');
      },
      restart: function() { g.over = false; g.won = false; g.paused = false; g.score = 0; g.t = 0; g.message = ''; g.data = {}; spec.init(g); },
      cache: {}
    };
    try { g.best = parseInt(localStorage.getItem(bestKey) || '0', 10) || 0; } catch (e) { g.best = 0; }

    // Offscreen layers games can cache static drawings in (walls, grids…)
    g.layer = function(id, draw, deps) {
      var k = id + '|' + (deps || '');
      var L = g.cache[id];
      if (!L || L.k !== k) {
        var cv = document.createElement('canvas');
        cv.width = Math.round(g.W * scale * dpr); cv.height = Math.round(g.H * scale * dpr);
        var lc = cv.getContext('2d');
        lc.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
        draw(lc, g);
        L = g.cache[id] = { k: k, cv: cv };
      }
      return L.cv;
    };

    function layout() {
      var st = gameStage();
      if (!_isFs) {
        _gameMode = true;
        win.classList.add('game-mode');
        win.style.maxWidth = st.w + 'px';
        win.style.height   = (st.h + (st.hdrH || 44)) + 'px';
      }
      var s2 = gameStage();              // re-measure once the window has its size
      cssW = Math.round(s2.w); cssH = Math.round(s2.h);
      dpr   = Math.min(window.devicePixelRatio || 1, 2);
      scale = Math.min(cssW / g.W, cssH / g.H);
      // optional pixel-perfect scaling (whole multiples only)
      var intScale = typeof spec.integerScale === 'function' ? spec.integerScale() : spec.integerScale;
      if (intScale && scale >= 1) scale = Math.floor(scale);
      ox = (cssW - g.W * scale) / 2; oy = (cssH - g.H * scale) / 2;
      canvas.style.display = 'block';
      canvas.style.width  = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width  = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      g.cache = {};                      // cached layers depend on the scale
      g.scale = scale;
    }
    g.relayout = function() { layout(); };

    function drawOverlay(title, sub) {
      c2d.fillStyle = 'rgba(2,6,14,.62)';
      c2d.fillRect(0, 0, g.W, g.H);
      c2d.textAlign = 'center';
      c2d.fillStyle = g.over && !g.won ? '#ff7b72' : g.color(1);
      c2d.font = 'bold ' + Math.round(g.H * 0.085) + 'px "JetBrains Mono", monospace';
      c2d.fillText(title, g.W / 2, g.H / 2 - g.H * 0.02);
      c2d.fillStyle = 'rgba(230,237,243,.92)';
      c2d.font = Math.round(g.H * 0.04) + 'px "JetBrains Mono", monospace';
      c2d.fillText(sub, g.W / 2, g.H / 2 + g.H * 0.07);
      c2d.textAlign = 'left';
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      _gameLoop = raf;
      var dt = Math.min(0.25, (now - last) / 1000 || 0); last = now;
      if (!g.paused && !g.over) {
        acc += dt;
        while (acc >= STEP) { g.t += STEP; spec.update(g, STEP); acc -= STEP; if (g.over) break; }
      } else acc = 0;

      // letterbox background, then the game in logical units
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2d.fillStyle = g.light() ? '#d7dbe2' : '#02060d';
      c2d.fillRect(0, 0, cssW, cssH);
      c2d.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      c2d.save();
      c2d.beginPath(); c2d.rect(0, 0, g.W, g.H); c2d.clip();
      spec.render(c2d, g);
      if (g.over) drawOverlay(g.message, 'score ' + g.score + '  ·  best ' + g.best + '  ·  R to replay  ·  Esc to quit');
      else if (g.paused && spec.pauseOverlay !== false) drawOverlay('PAUSED', 'P to resume  ·  Esc to quit');
      c2d.restore();
    }

    var handled = {};
    (spec.keys || []).concat(['Escape', 'p', 'P', 'r', 'R', 'Enter']).forEach(function(k) { handled[k] = true; });

    function onKeyDown(e) {
      if (e.key === 'Escape' || (e.ctrlKey && (e.key === 'c' || e.key === 'C'))) { e.preventDefault(); stopGame(); return; }
      if (e.key === 'p' || e.key === 'P') { if (!g.over) g.paused = !g.paused; e.preventDefault(); return; }
      if (g.over && (e.key === 'r' || e.key === 'R' || e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); g.restart(); return; }
      if (handled[e.key]) e.preventDefault();
      keys[e.key] = true;
      if (!g.paused && !g.over && spec.onKey) spec.onKey(g, e.key, true, e);
    }
    function onKeyUp(e) {
      keys[e.key] = false;
      if (spec.onKey) spec.onKey(g, e.key, false, e);
    }
    function onMouse(e) {
      if (!spec.onPointer || g.paused || g.over) return;
      var r = canvas.getBoundingClientRect();
      spec.onPointer(g, (e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale);
    }
    function onResize() { layout(); }
    function onVisibility() { if (document.hidden && !g.over) g.paused = true; }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouse);
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    _engine = {
      layout: layout,
      destroy: function() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
        document.removeEventListener('mousemove', onMouse);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        if (spec.exit) try { spec.exit(g); } catch (e) {}
        g.cache = {};
      }
    };

    layout();
    if (!_isFs) {                        // bring the whole game window on screen
      var wr = win.getBoundingClientRect(), st0 = gameStage();
      var winH = st0.h + (st0.hdrH || 44);  // target height (the window may still be animating)
      var navH = (document.querySelector('.main-header') || {}).offsetHeight || 0;
      if (wr.top + winH > window.innerHeight || wr.top < navH) {
        var y = window.scrollY + wr.top - navH - Math.max(8, (window.innerHeight - navH - winH) / 2);
        window.scrollTo({ top: Math.max(0, y), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
    spec.init(g);
    printLine((spec.title || spec.name.toUpperCase()) + ' — ' + (spec.controls || '') + ' · P pause · Esc quit' + (g.best ? ' · best ' + g.best : ''), 'term-out-bold');
    last = performance.now();
    win.classList.add('is-playing');
    raf = requestAnimationFrame(frame);
    _gameLoop = raf;
    try { canvas.focus({ preventScroll: true }); } catch (e) {}
    return g;
  }

  // Games: keep arrow keys / space from scrolling the page while playing
  document.addEventListener('keydown', function(e) {
    if (!_gameLoop) return;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) !== -1) e.preventDefault();
  }, { capture: true });

  if (gameExit) gameExit.addEventListener('click', function(e) { e.stopPropagation(); stopGame(true); });

  // Touch controls: swipe → arrow keys, tap → the game's `touch.tap` key,
  // drag → mousemove (for pointer-driven games such as Pong).
  if (canvas && isTouch) {
    var t0 = null;
    canvas.addEventListener('touchstart', function(e) {
      if (!_gameLoop || !e.touches.length) return;
      var t = e.touches[0];
      t0 = { x: t.clientX, y: t.clientY, time: Date.now() };
    }, { passive: true });
    canvas.addEventListener('touchmove', function(e) {
      if (!_gameLoop || !e.touches.length) return;
      e.preventDefault();   // no page scroll / pull-to-refresh while playing
      var touch = _game && _game.touch;
      if (touch && touch.drag) {
        var t = e.touches[0];
        document.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
      }
    }, { passive: false });
    canvas.addEventListener('touchend', function(e) {
      if (!_gameLoop || !t0 || !e.changedTouches.length) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - t0.x, dy = t.clientY - t0.y;
      var adx = Math.abs(dx), ady = Math.abs(dy);
      var touch = (_game && _game.touch) || {};
      if (Math.max(adx, ady) < 24) {
        if (touch.tap) tapKey(touch.tap);
      } else if (!touch.drag) {
        tapKey(adx > ady ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft') : (dy > 0 ? 'ArrowDown' : 'ArrowUp'));
      }
      t0 = null;
    }, { passive: true });
  }

  // ── Command dispatch ──────────────────────────────────────────────────────
  function runCommand(raw) {
    var parts = raw.split(/\s+/), name = parts[0].replace(/^\//, '').toLowerCase(), args = parts.slice(1);
    if (name === 'exit' || name === 'quit') {
      printLine('logout', 'term-out-dim');
      setTimeout(closeTerminal, 400);
      return;
    }
    var cmds = enabledCommands();
    if (Object.prototype.hasOwnProperty.call(cmds, name)) {
      _game = cmds[name];
      try { cmds[name].run(args, ctx); }
      catch (err) {
        console.error('[Terminal] ' + name + ':', err);
        printLine(name + ': internal error (see console)', 'term-out-error');
        stopGame(true);
      }
      if (!_gameLoop) setTimeout(function() { if (!_gameLoop) _game = null; }, 1000);
      return;
    }
    printLine('-bash: ' + parts[0] + ': command not found', 'term-out-error');
    printLine('Type /help for available commands.', 'term-out-dim');
  }

  function metaVal(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? (el.getAttribute('content') || '') : '';
  }

  // Only same-origin or https images may be used as the boot logo
  function safeImageUrl(u) {
    if (!u) return '';
    try {
      var url = new URL(u, location.href);
      if (url.origin === location.origin || url.protocol === 'https:') return url.href;
    } catch (e) {}
    return '';
  }

  // ── Boot — neofetch with configurable ASCII art or logo image ─────────────
  function boot() {
    if (_booted) return;
    _booted = true;
    loadHistory();

    // Restore saved color (validated: it ends up in a CSS custom property)
    try {
      var saved = sessionStorage.getItem(STORAGE_COLOR);
      if (saved && RGB_RE.test(saved)) {
        var sp = saved.split(',').map(Number);
        if (sp.every(function(n) { return n <= 255; })) {
          _userColor = saved;
          applyWindowStyle(sp[0], sp[1], sp[2]);
        }
      }
    } catch (e) {}

    neofetch();

    if (cfg.welcome) setTimeout(function() {
      printLine('$ ' + cfg.welcome, 'term-out-dim');
      runCommand(cfg.welcome);
    }, 250);

    if (cfg.autofocus && !isTouch) setTimeout(focusInput, 150);
  }

  // neofetch-style banner (boot screen, and the `neofetch` command)
  function neofetch() {
    var user  = metaVal('term-boot-user')  || 'YOUR_USER';
    var host  = metaVal('term-boot-host')  || 'YOUR_HOST';
    var os    = metaVal('term-boot-os')    || 'YOUR_OS';
    var shellName = metaVal('term-boot-shell') || 'YOUR_SHELL';
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
      'Shell:  ' + shellName,
      'Uptime: ' + uptime,
      'Posts:  ' + posts
    ];
    if (role && role !== 'YOUR_ROLE') info.push('Role:   ' + role);
    if (line1) info.push(line1);
    if (line2) info.push(line2);

    var image = safeImageUrl(metaVal('term-boot-image'));
    if (image) {
      // Logo image on the left, info lines on the right
      var row  = document.createElement('div');
      row.className = 'term-neofetch';
      var img  = document.createElement('img');
      img.className = 'term-neofetch-logo';
      img.src = image;
      img.alt = metaVal('term-boot-image-alt') || '';
      img.decoding = 'async';
      img.addEventListener('load', function() { output.scrollTop = output.scrollHeight; });
      var col  = document.createElement('div');
      col.className = 'term-neofetch-info';
      info.forEach(function(l) {
        var d = document.createElement('div');
        d.className = 'terminal-line term-out-ascii';
        d.textContent = l;
        col.appendChild(d);
      });
      row.appendChild(img); row.appendChild(col);
      output.appendChild(row);
    } else {
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
      var pad = function(str, n) { var o = str || ''; while (o.length < n) o += ' '; return o.slice(0, n); };
      var rows = Math.max(logo.length, info.length);
      // On narrow phones the side-by-side layout wraps badly → info only
      var narrow = output.clientWidth && output.clientWidth < 420;
      for (var i = 0; i < rows; i++) {
        if (narrow) { if (info[i]) printLine(info[i], 'term-out-ascii'); }
        else printLine(pad(logo[i] || '', PAD) + (info[i] || ''), 'term-out-ascii');
      }
    }

    printLine('', 'term-out-dim');
    printLine('  ' + motd, 'term-out-bold');
    printLine('', 'term-out-dim');
  }

  window.addEventListener('resize', updateNavH, { passive: true });
  updateNavH();

  // On phones with the launcher, boot lazily when the terminal is first opened
  var startsHidden = isPhone() && cfg.mobile !== 'show';
  if (!startsHidden) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

})();
