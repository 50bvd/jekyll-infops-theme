/**
 * terminal-commands/gba.js — Game Boy Advance emulator (gpSP → WebAssembly).
 *
 *   gba            pick a ROM (.gba) on your computer — or drop it on the terminal
 *   gba last       reload the last ROM (kept in this browser only)
 *   gba help       controls
 *
 * Everything runs locally: the ROM is read in the browser and never uploaded.
 * gpSP (the emulator of the GP2X / PSP scene, GPL-2.0) is built to WebAssembly
 * by tools/gba-emulator/build.sh; its open-source BIOS is built in. The
 * emulator (~500 KB) is only downloaded the first time `gba` is used.
 *
 * Runs on the terminal game engine (ctx.createGame): same window as the other
 * games, scaled in fullscreen. Battery saves are kept in IndexedDB per game;
 * F2 / F4 save / load a quick state. On touch screens an on-screen pad appears.
 */
(function() {
  var W = 240, H = 160, MAX_ROM = 32 * 1024 * 1024;
  // libretro joypad ids
  var B = 0, SELECT = 2, START = 3, UP = 4, DOWN = 5, LEFT = 6, RIGHT = 7, A = 8, L = 10, R = 11;
  // physical keys (e.code) so it works the same on QWERTY and AZERTY
  var CODES = {
    ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT,
    KeyX: A, KeyZ: B, KeyA: L, KeyS: R, Enter: START, Backspace: SELECT, ShiftRight: SELECT, ShiftLeft: SELECT
  };

  var scriptSrc = (document.currentScript && document.currentScript.src) || '';
  var coreUrl = scriptSrc ? scriptSrc.replace(/js\/terminal-commands\/gba\.js.*$/, 'vendor/gpsp/gpsp.js') : '/assets/vendor/gpsp/gpsp.js';
  var modulePromise = null, audio = null;

  // ── Emulator core (loaded on first use) ──────────────────────────────────
  function loadCore() {
    if (modulePromise) return modulePromise;
    modulePromise = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = coreUrl; s.async = true;
      s.onload = function() {
        if (typeof window.createGpsp !== 'function') { reject(new Error('core did not load')); return; }
        window.createGpsp().then(function(M) { M._gba_init(); resolve(M); }, reject);
      };
      s.onerror = function() { reject(new Error('cannot download ' + coreUrl)); };
      document.head.appendChild(s);
    }).catch(function(e) { modulePromise = null; throw e; });
    return modulePromise;
  }

  // ── Storage (IndexedDB, local to this browser) ───────────────────────────
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function(res, rej) {
      if (!window.indexedDB) { rej(new Error('no IndexedDB')); return; }
      var r = indexedDB.open('infops-gba', 1);
      r.onupgradeneeded = function() { r.result.createObjectStore('kv'); };
      r.onsuccess = function() { res(r.result); };
      r.onerror = function() { rej(r.error); };
    });
    return dbp;
  }
  function idb(mode, fn) {
    return db().then(function(d) {
      return new Promise(function(res, rej) {
        var tx = d.transaction('kv', mode), req = fn(tx.objectStore('kv'));
        tx.oncomplete = function() { res(req && req.result); };
        tx.onerror = tx.onabort = function() { rej(tx.error); };
      });
    });
  }
  function get(k) { return idb('readonly', function(s) { return s.get(k); }).catch(function() { return null; }); }
  function put(k, v) { return idb('readwrite', function(s) { return s.put(v, k); }).catch(function() {}); }

  // ── Audio: 32 kHz core output → the device rate (linear resampling with a
  // small drift correction that keeps ~60 ms buffered) ─────────────────────
  function Audio(rate) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ctx = new AC(), size = 1 << 15, ring = new Float32Array(size * 2), w = 0, r = 0, pos = 0;
    var node = ctx.createScriptProcessor(2048, 0, 2), target = rate * 0.06;
    node.onaudioprocess = function(e) {
      var L = e.outputBuffer.getChannelData(0), Rt = e.outputBuffer.getChannelData(1);
      var avail = (w - r + size) % size;
      var step = rate / ctx.sampleRate * Math.max(0.995, Math.min(1.005, 1 + (avail - target) / (target * 40)));
      for (var i = 0; i < L.length; i++) {
        if (((w - r + size) % size) < 2) { L[i] = Rt[i] = 0; continue; }
        var i0 = r * 2, i1 = ((r + 1) % size) * 2;
        L[i]  = ring[i0] + (ring[i1] - ring[i0]) * pos;
        Rt[i] = ring[i0 + 1] + (ring[i1 + 1] - ring[i0 + 1]) * pos;
        pos += step;
        while (pos >= 1) { pos -= 1; r = (r + 1) % size; }
      }
    };
    node.connect(ctx.destination);
    return {
      ctx: ctx,
      push: function(heap16, ptr, frames) {
        var base = ptr >> 1;
        for (var i = 0; i < frames; i++) {
          if (((w + 1) % size) === r) break;               // full: drop
          ring[w * 2] = heap16[base + i * 2] / 32768;
          ring[w * 2 + 1] = heap16[base + i * 2 + 1] / 32768;
          w = (w + 1) % size;
        }
      },
      clear: function() { r = w; pos = 0; },
      resume: function() { if (ctx.state === 'suspended') ctx.resume(); }
    };
  }

  // RGB565 → RGBA lookup table (built once)
  var LUT = null;
  function lut() {
    if (LUT) return LUT;
    LUT = new Uint32Array(65536);
    var le = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
    for (var v = 0; v < 65536; v++) {
      var r = (v >> 11) & 31, g = (v >> 5) & 63, b = v & 31;
      r = (r << 3) | (r >> 2); g = (g << 2) | (g >> 4); b = (b << 3) | (b >> 2);
      LUT[v] = le ? (0xff000000 | (b << 16) | (g << 8) | r) : ((r << 24) | (g << 16) | (b << 8) | 0xff);
    }
    return LUT;
  }

  function romInfo(bytes) {
    var title = '', code = '';
    for (var i = 0xA0; i < 0xAC; i++) if (bytes[i] >= 32 && bytes[i] < 127) title += String.fromCharCode(bytes[i]);
    for (i = 0xAC; i < 0xB0; i++) if (bytes[i] >= 32 && bytes[i] < 127) code += String.fromCharCode(bytes[i]);
    title = title.trim();
    return { title: title || 'GBA ROM', id: (code || 'XXXX') + '-' + title.replace(/\W+/g, '_') + '-' + bytes.length, valid: bytes[0xB2] === 0x96 };
  }

  // ── Touch pad ────────────────────────────────────────────────────────────
  function touchPad(host, setBit) {
    var pad = document.createElement('div');
    pad.className = 'gba-pad';
    pad.setAttribute('aria-hidden', 'true');
    var html = '';
    [['L', L, 'gba-l'], ['R', R, 'gba-r'], ['▲', UP, 'gba-up'], ['◀', LEFT, 'gba-left'], ['▶', RIGHT, 'gba-right'], ['▼', DOWN, 'gba-down'],
     ['B', B, 'gba-b'], ['A', A, 'gba-a'], ['SELECT', SELECT, 'gba-select'], ['START', START, 'gba-start']].forEach(function(b) {
      html += '<button type="button" class="gba-btn ' + b[2] + '" data-bit="' + b[1] + '">' + b[0] + '</button>';
    });
    pad.innerHTML = html;
    function handle(e, down) {
      var t = e.target.closest && e.target.closest('[data-bit]');
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      setBit(+t.getAttribute('data-bit'), down);
      t.classList.toggle('is-down', down);
    }
    pad.addEventListener('pointerdown', function(e) { try { e.target.releasePointerCapture(e.pointerId); } catch (x) {} handle(e, true); });
    pad.addEventListener('pointerup', function(e) { handle(e, false); });
    pad.addEventListener('pointerleave', function(e) { handle(e, false); }, true);
    pad.addEventListener('pointercancel', function(e) { handle(e, false); });
    pad.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
    host.appendChild(pad);
    return pad;
  }

  // ── Run a ROM ────────────────────────────────────────────────────────────
  function start(bytes, name, ctx) {
    if (bytes.length > MAX_ROM || bytes.length < 0xC0) { ctx.printLine('gba: not a GBA ROM (' + Math.round(bytes.length / 1024) + ' KB)', 'term-out-error'); return; }
    var info = romInfo(bytes);
    if (!info.valid) ctx.printLine('gba: warning — unusual ROM header, trying anyway', 'term-out-warn');
    ctx.printLine('gba: loading ' + (name || info.title) + '…', 'term-out-dim');
    if (!audio) try { audio = Audio(32768); } catch (e) { audio = null; }

    loadCore().then(function(M) {
      M.FS.writeFile('/rom.gba', bytes);
      var path = new TextEncoder().encode('/rom.gba\0'), p = M._malloc(path.length);
      M.HEAPU8.set(path, p);
      var ok = M._gba_load(p);
      M._free(p);
      try { M.FS.unlink('/rom.gba'); } catch (e) {}
      if (!ok) { ctx.printLine('gba: this ROM could not be loaded', 'term-out-error'); return; }
      put('lastrom', { name: name || info.title, data: bytes });
      return get('sram:' + info.id).then(function(saved) {
        var sp = M._gba_sram_ptr(), ss = M._gba_sram_size();
        if (saved && sp && ss) { M.HEAPU8.set(new Uint8Array(saved).subarray(0, ss), sp); M._gba_reset(); }
        run(M, info, ctx, !!saved);
      });
    }).catch(function(e) {
      ctx.printLine('gba: ' + e.message, 'term-out-error');
      if (/wasm|WebAssembly|CompileError|unsafe-eval/i.test(String(e))) ctx.printLine('gba: this page does not allow WebAssembly (Content-Security-Policy)', 'term-out-dim');
    });
  }

  function run(M, info, ctx, hadSave) {
    var keys = 0, frameTime = 1 / M._gba_fps(), acc = 0, fast = false;
    var off = document.createElement('canvas'); off.width = W; off.height = H;
    var octx = off.getContext('2d'), img = octx.createImageData(W, H), pix = new Uint32Array(img.data.buffer), table = lut();
    var sramPtr = M._gba_sram_ptr(), sramSize = M._gba_sram_size(), lastSram = null, saveTimer = 0, toast = '', toastT = 0;
    var pad = null, win = document.getElementById('hero-terminal');

    function setBit(bit, down) { keys = down ? (keys | (1 << bit)) : (keys & ~(1 << bit)); M._gba_set_keys(keys); }
    function note(t) { toast = t; toastT = 1.6; }
    function saveSram(force) {
      if (!sramPtr || !sramSize) return;
      var cur = M.HEAPU8.slice(sramPtr, sramPtr + sramSize);
      if (!force && lastSram && cur.every(function(v, i) { return v === lastSram[i]; })) return;
      lastSram = cur;
      put('sram:' + info.id, cur.buffer);
    }

    if (audio) { audio.clear(); audio.resume(); }
    M._gba_set_keys(0);

    ctx.createGame({
      name: 'gba', title: '🎮 GBA — ' + info.title,
      controls: 'arrows · X=A · Z=B · A/S=L/R · Enter=Start · Backspace=Select · Space=fast · F2/F4 state',
      width: W, height: H,
      keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace', ' ', 'F2', 'F4', 'x', 'X', 'z', 'Z', 'w', 'W', 'a', 'A', 'q', 'Q', 's', 'S'],

      init: function(g) {
        g.data.started = true;
        if (hadSave) note('save loaded');
        if (ctx.isTouch() && win) pad = touchPad(win, setBit);
      },

      onKey: function(g, key, down, e) {
        var code = e && e.code;
        if (key === ' ') { fast = down; return; }
        if (down && key === 'F2') {
          if (M._gba_state_save()) { put('state:' + info.id, M.HEAPU8.slice(M._gba_state_ptr(), M._gba_state_ptr() + M._gba_state_size()).buffer); note('state saved'); }
          return;
        }
        if (down && key === 'F4') {
          get('state:' + info.id).then(function(st) {
            if (!st) { note('no saved state'); return; }
            var p = M._gba_state_ptr(), n = M._gba_state_size();
            M.HEAPU8.set(new Uint8Array(st).subarray(0, n), p);
            note(M._gba_state_load() ? 'state loaded' : 'state failed');
          });
          return;
        }
        var bit = CODES[code];
        if (bit == null) bit = CODES[key];
        if (bit != null) setBit(bit, down);
      },

      update: function(g, dt) {
        acc += dt * (fast ? 3 : 1);
        var n = 0;
        while (acc >= frameTime && n < (fast ? 4 : 2)) {
          M._gba_run_frame(); acc -= frameTime; n++;
          if (audio && !fast) audio.push(M.HEAP16, M._gba_audio_ptr(), M._gba_audio_frames());
        }
        if (acc > frameTime * 4) acc = 0;
        if (toastT > 0) toastT -= dt;
        if ((saveTimer += dt) > 3) { saveTimer = 0; saveSram(false); }
      },

      render: function(c, g) {
        var fp = M._gba_frame_ptr() >> 1, src = M.HEAPU16;
        for (var i = 0; i < W * H; i++) pix[i] = table[src[fp + i]];
        octx.putImageData(img, 0, 0);
        c.imageSmoothingEnabled = false;
        c.drawImage(off, 0, 0, W, H);
        if (toastT > 0) {
          c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, H - 16, W, 16);
          c.fillStyle = '#fff'; c.font = '10px "JetBrains Mono", monospace'; c.fillText(toast, 4, H - 5);
        }
        if (audio && g.paused !== audio.paused) { audio.paused = g.paused; if (g.paused) audio.ctx.suspend(); else audio.resume(); }
      },

      exit: function() {
        saveSram(true);
        if (audio) { audio.clear(); audio.ctx.suspend(); }
        if (pad && pad.parentNode) pad.parentNode.removeChild(pad);
        M._gba_set_keys(0);
        window.removeEventListener('pagehide', onHide);
      }
    });
    function onHide() { saveSram(true); }
    window.addEventListener('pagehide', onHide);
  }

  // ── File picking / drag & drop ───────────────────────────────────────────
  function readFile(file, ctx) {
    if (!file) return;
    if (!/\.(gba|agb|bin|mb)$/i.test(file.name)) { ctx.printLine('gba: expected a .gba file (zip archives are not supported)', 'term-out-error'); return; }
    if (file.size > MAX_ROM) { ctx.printLine('gba: file too large for a GBA ROM', 'term-out-error'); return; }
    file.arrayBuffer().then(function(buf) { start(new Uint8Array(buf), file.name, ctx); });
  }

  function pick(ctx) {
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.gba,.agb,.bin,.mb';
    input.style.display = 'none';
    input.addEventListener('change', function() { readFile(input.files && input.files[0], ctx); input.remove(); });
    input.addEventListener('cancel', function() { ctx.printLine('gba: no ROM selected', 'term-out-dim'); input.remove(); });
    document.body.appendChild(input);
    input.click();
  }

  var win = document.getElementById('hero-terminal');
  if (win) {
    win.addEventListener('dragover', function(e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); win.classList.add('is-dropping'); }
    });
    win.addEventListener('dragleave', function() { win.classList.remove('is-dropping'); });
    win.addEventListener('drop', function(e) {
      win.classList.remove('is-dropping');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      if (!audio) try { audio = Audio(32768); } catch (x) { audio = null; }
      readFile(f, window.Terminal.ctx);
    });
  }

  window.Terminal.register({
    name: 'gba',
    aliases: ['gameboy'],
    help: ['gba [last|help]', 'Game Boy Advance emulator', 'games'],
    touch: { none: true },
    run: function(args, ctx) {
      var sub = (args[0] || '').toLowerCase();
      if (sub === 'help') {
        ctx.printLines([
          'Game Boy Advance emulator — gpSP compiled to WebAssembly (GPL-2.0)',
          '  gba          choose a .gba ROM on your computer (or drop it on the terminal)',
          '  gba last     reload the last ROM',
          'The ROM stays in your browser: nothing is uploaded. Built-in open-source BIOS.',
          'Keys: arrows · X = A · Z = B · A / S = L / R · Enter = Start · Backspace = Select',
          '      Space (hold) = fast forward · F2 / F4 = save / load state · P = pause · Esc = quit',
          'Game saves are kept automatically in this browser.'
        ], 'term-out');
        return;
      }
      if (!window.WebAssembly) { ctx.printLine('gba: WebAssembly is not available in this browser', 'term-out-error'); return; }
      if (!audio) try { audio = Audio(32768); } catch (e) { audio = null; }   // needs this key press
      loadCore().catch(function() {});                                         // start downloading now
      if (sub === 'last') {
        get('lastrom').then(function(r) {
          if (!r || !r.data) { ctx.printLine('gba: no previous ROM in this browser — type gba', 'term-out-dim'); return; }
          start(new Uint8Array(r.data), r.name, ctx);
        });
        return;
      }
      ctx.printLine('gba: choose a .gba ROM (or drop it on the terminal)…', 'term-out-dim');
      pick(ctx);
    }
  });
})();
