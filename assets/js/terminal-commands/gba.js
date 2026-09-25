/**
 * terminal-commands/gba.js — Game Boy Advance emulator (gpSP → WebAssembly).
 *
 *   gba            open the emulator: ROM library (if the site has one),
 *                  a ROM from your computer, settings
 *   gba last       reload the last ROM (kept in this browser only)
 *   gba settings   controls, video, audio, saves
 *   gba help       controls
 *
 * Everything runs locally: ROMs are read / downloaded by the browser and
 * emulated on the visitor's machine. gpSP (the GP2X / PSP scene emulator,
 * GPL-2.0) is built to WebAssembly by tools/gba-emulator/build.sh, with its
 * open-source BIOS. The core (~500 KB) is only downloaded when `gba` is used.
 *
 * Saves: battery saves are kept per game in IndexedDB, can be exported /
 * imported as .sav files, and — in Chromium browsers — linked to a .sav file
 * on the computer that is updated automatically while playing.
 * Optional server library: theme_config.gba.library in _config.yml points to
 * a JSON list of ROMs (see tools/gba-emulator/README.md).
 */
(function() {
  'use strict';
  var W = 240, H = 160, MAX_ROM = 32 * 1024 * 1024;
  // libretro joypad ids
  var BIT = { b: 0, select: 2, start: 3, up: 4, down: 5, left: 6, right: 7, a: 8, l: 10, r: 11 };
  var ACTIONS = [
    ['up', 'Up'], ['down', 'Down'], ['left', 'Left'], ['right', 'Right'],
    ['a', 'A'], ['b', 'B'], ['l', 'L'], ['r', 'R'], ['start', 'Start'], ['select', 'Select'],
    ['fast', 'Fast forward (hold)'], ['save', 'Save state'], ['load', 'Load state'], ['menu', 'Menu']
  ];
  var DEFAULTS = {
    keys: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', a: 'KeyX', b: 'KeyZ',
            l: 'KeyA', r: 'KeyS', start: 'Enter', select: 'Backspace', fast: 'Space', save: 'F2', load: 'F4', menu: 'F1' },
    smooth: false, integer: false, scanlines: 0, color: true, blend: false, fps: false,
    volume: 0.8, mute: false, ffSpeed: 3
  };
  var SKEY = 'infops-gba-settings';

  var scriptSrc = (document.currentScript && document.currentScript.src) || '';
  var base = scriptSrc ? scriptSrc.replace(/js\/terminal-commands\/gba\.js.*$/, '') : '/assets/';
  var coreUrl = base + 'vendor/gpsp/gpsp.js';
  var libMeta = document.querySelector('meta[name="gba-library"]');
  var libraryUrl = libMeta ? libMeta.getAttribute('content') : '';

  // ── Settings ─────────────────────────────────────────────────────────────
  function loadSettings() {
    var s = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var saved = JSON.parse(localStorage.getItem(SKEY) || '{}');
      Object.keys(DEFAULTS).forEach(function(k) {
        if (k === 'keys' && saved.keys) Object.keys(DEFAULTS.keys).forEach(function(a) { if (typeof saved.keys[a] === 'string') s.keys[a] = saved.keys[a]; });
        else if (k !== 'keys' && typeof saved[k] === typeof DEFAULTS[k]) s[k] = saved[k];
      });
    } catch (e) {}
    return s;
  }
  var settings = loadSettings();
  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) {} }
  function keyLabel(code) {
    if (!code) return '—';
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace(/^Numpad/, 'Num ');
  }

  // ── Emulator core (loaded on first use) ──────────────────────────────────
  var modulePromise = null;
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
  function cstr(M, str) {
    var b = new TextEncoder().encode(str + '\0'), p = M._malloc(b.length);
    M.HEAPU8.set(b, p);
    return p;
  }
  function setOption(M, key, value) {
    var k = cstr(M, key), v = cstr(M, value);
    M._gba_set_option(k, v); M._free(k); M._free(v);
  }
  function applyCoreOptions(M) {
    setOption(M, 'gpsp_color_correction', settings.color ? 'enabled' : 'disabled');
    setOption(M, 'gpsp_frame_mixing', settings.blend ? 'enabled' : 'disabled');
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
  function del(k) { return idb('readwrite', function(s) { return s.delete(k); }).catch(function() {}); }

  // ── Audio: 32 kHz core output → device rate (linear resampling + drift
  // correction keeping ~60 ms buffered) ────────────────────────────────────
  var audio = null;
  function makeAudio(rate) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ctx = new AC(), size = 1 << 15, ring = new Float32Array(size * 2), w = 0, r = 0, pos = 0;
    var gain = ctx.createGain();
    var node = ctx.createScriptProcessor(2048, 0, 2), target = rate * 0.06;
    node.onaudioprocess = function(e) {
      var L = e.outputBuffer.getChannelData(0), R = e.outputBuffer.getChannelData(1);
      var avail = (w - r + size) % size;
      var step = rate / ctx.sampleRate * Math.max(0.995, Math.min(1.005, 1 + (avail - target) / (target * 40)));
      for (var i = 0; i < L.length; i++) {
        if (((w - r + size) % size) < 2) { L[i] = R[i] = 0; continue; }
        var i0 = r * 2, i1 = ((r + 1) % size) * 2;
        L[i] = ring[i0] + (ring[i1] - ring[i0]) * pos;
        R[i] = ring[i0 + 1] + (ring[i1 + 1] - ring[i0 + 1]) * pos;
        pos += step;
        while (pos >= 1) { pos -= 1; r = (r + 1) % size; }
      }
    };
    node.connect(gain); gain.connect(ctx.destination);
    var a = {
      ctx: ctx, paused: false,
      push: function(heap16, ptr, frames) {
        var b = ptr >> 1;
        for (var i = 0; i < frames; i++) {
          if (((w + 1) % size) === r) break;
          ring[w * 2] = heap16[b + i * 2] / 32768;
          ring[w * 2 + 1] = heap16[b + i * 2 + 1] / 32768;
          w = (w + 1) % size;
        }
      },
      clear: function() { r = w; pos = 0; },
      volume: function() { gain.gain.value = settings.mute ? 0 : settings.volume; },
      resume: function() { if (ctx.state === 'suspended') ctx.resume(); }
    };
    a.volume();
    return a;
  }
  function ensureAudio() { if (!audio) try { audio = makeAudio(32768); } catch (e) { audio = null; } if (audio) audio.resume(); }

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

  // ── .zip support (first .gba inside; stored or deflate) ──────────────────
  function unzip(bytes) {
    var dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (var e = bytes.length - 22; e >= Math.max(0, bytes.length - 65557); e--) {
      if (dv.getUint32(e, true) !== 0x06054b50) continue;        // end of central directory
      var n = dv.getUint16(e + 10, true), off = dv.getUint32(e + 16, true);
      for (var i = 0; i < n; i++) {
        if (dv.getUint32(off, true) !== 0x02014b50) break;
        var method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true), usize = dv.getUint32(off + 24, true);
        var nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
        var local = dv.getUint32(off + 42, true);
        var name = new TextDecoder().decode(bytes.subarray(off + 46, off + 46 + nlen));
        off += 46 + nlen + xlen + clen;
        if (!/\.(gba|agb|bin)$/i.test(name) || usize > MAX_ROM) continue;
        var start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
        var data = bytes.subarray(start, start + csize);
        if (method === 0) return Promise.resolve({ name: name, data: data.slice() });
        if (method === 8 && window.DecompressionStream) {
          var ds = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
          return new Response(ds).arrayBuffer().then(function(buf) { return { name: name, data: new Uint8Array(buf) }; });
        }
        return Promise.reject(new Error('unsupported zip compression'));
      }
    }
    return Promise.reject(new Error('no .gba file in this zip'));
  }
  function isZip(bytes) { return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4; }

  // ── Downloads / files ────────────────────────────────────────────────────
  function sameOrigin(url) {
    try { var u = new URL(url, location.href); return u.origin === location.origin ? u.href : null; } catch (e) { return null; }
  }
  function download(url, onProgress, signal) {
    return fetch(url, { credentials: 'same-origin', signal: signal }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var total = +r.headers.get('content-length') || 0;
      if (!r.body || !r.body.getReader) return r.arrayBuffer().then(function(b) { return new Uint8Array(b); });
      var reader = r.body.getReader(), chunks = [], got = 0;
      function pump() {
        return reader.read().then(function(x) {
          if (x.done) {
            var out = new Uint8Array(got), p = 0;
            chunks.forEach(function(c) { out.set(c, p); p += c.length; });
            return out;
          }
          chunks.push(x.value); got += x.value.length;
          if (got > MAX_ROM * 2) throw new Error('file too large');
          onProgress(got, total);
          return pump();
        });
      }
      return pump();
    });
  }
  function saveBlob(bytes, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 5000);
  }
  function pickFile(accept) {
    return new Promise(function(resolve) {
      var input = document.createElement('input');
      input.type = 'file'; input.accept = accept; input.style.display = 'none';
      input.addEventListener('change', function() { resolve(input.files && input.files[0]); input.remove(); });
      input.addEventListener('cancel', function() { resolve(null); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }
  function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
  function fileName(t) { return String(t).replace(/[^\w .-]+/g, '').trim() || 'game'; }

  // ── The emulator session (one at a time) ─────────────────────────────────
  var session = null;

  function openEmulator(ctx, opts) {
    opts = opts || {};
    if (!window.WebAssembly) { ctx.printLine('gba: WebAssembly is not available in this browser', 'term-out-error'); return; }
    ensureAudio();
    loadCore().catch(function() {});                         // start downloading now
    if (session) {
      if (opts.rom) session.start(opts.rom.data, opts.rom.name); else session.showMenu(opts.screen);
      return;
    }

    var win = document.getElementById('hero-terminal');
    var S = session = {
      M: null, info: null, keys: 0, running: false, fast: false, acc: 0, frameTime: 1 / 59.7275,
      fpsCount: 0, fpsT: 0, fps: 0, toast: '', toastT: 0, sramSnap: null, saveTimer: 0,
      fileHandle: null, pendingHandle: null, g: null, pad: null, capture: null
    };
    var off = document.createElement('canvas'); off.width = W; off.height = H;
    var octx = off.getContext('2d'), img = octx.createImageData(W, H), pix = new Uint32Array(img.data.buffer), table = lut();

    function note(t) { S.toast = t; S.toastT = 2; }
    function setBit(bit, down) { S.keys = down ? (S.keys | (1 << bit)) : (S.keys & ~(1 << bit)); if (S.M) S.M._gba_set_keys(S.keys); }

    // ── saves ──
    function sram() {
      if (!S.M || !S.running) return null;
      var p = S.M._gba_sram_ptr(), n = S.M._gba_sram_size();
      return p && n ? S.M.HEAPU8.subarray(p, p + n) : null;
    }
    function persistSram(force) {
      var cur = sram();
      if (!cur) return;
      if (!force && S.sramSnap && cur.length === S.sramSnap.length && cur.every(function(v, i) { return v === S.sramSnap[i]; })) return;
      S.sramSnap = cur.slice();
      put('sram:' + S.info.id, S.sramSnap.buffer.slice(0));
      if (S.fileHandle) writeHandle(S.fileHandle, S.sramSnap);
    }
    function writeHandle(hd, bytes) {
      return hd.createWritable().then(function(w) { return w.write(bytes).then(function() { return w.close(); }); })
        .catch(function() { note('could not write the .sav file'); });
    }
    function importSave(bytes) {
      var cur = sram();
      if (!cur) { note('start a game first'); return; }
      cur.set(bytes.subarray(0, cur.length));
      S.M._gba_reset();
      persistSram(true);
      note('save imported');
    }
    function linkSaveFile() {
      if (!window.showSaveFilePicker) return;
      window.showSaveFilePicker({ suggestedName: fileName(S.info.title) + '.sav',
        types: [{ description: 'GBA save', accept: { 'application/octet-stream': ['.sav'] } }] })
        .then(function(hd) {
          S.fileHandle = hd; S.pendingHandle = null;
          put('fsh:' + S.info.id, hd);
          persistSram(true);
          note('saving to ' + hd.name);
          render();
        }).catch(function() {});
    }

    // ── game loading ──
    function loadRom(bytes, name) {
      var p0 = isZip(bytes) ? unzip(bytes).then(function(z) { name = z.name; return z.data; }) : Promise.resolve(bytes);
      var info;
      return p0.then(function(rom) {
        if (rom.length > MAX_ROM || rom.length < 0xC0) throw new Error('not a GBA ROM');
        info = romInfo(rom);
        return loadCore().then(function(M) {
          if (S.running) persistSram(true);
          S.running = false;
          S.M = M;
          M.FS.writeFile('/rom.gba', rom);
          var p = cstr(M, '/rom.gba'), ok = M._gba_load(p);
          M._free(p);
          try { M.FS.unlink('/rom.gba'); } catch (e) {}
          if (!ok) throw new Error('this ROM could not be loaded');
          applyCoreOptions(M);
          S.info = info; S.frameTime = 1 / M._gba_fps(); S.keys = 0; M._gba_set_keys(0);
          put('lastrom', { name: name || info.title, data: rom });
          return Promise.all([get('sram:' + info.id), get('fsh:' + info.id)]);
        });
      }).then(function(r) {
        var saved = r[0], handle = r[1];
        S.fileHandle = null; S.pendingHandle = null; S.sramSnap = null;
        S.running = true;
        var restore = function(bytes, from) {
          var cur = sram();
          if (cur && bytes && bytes.byteLength) { cur.set(new Uint8Array(bytes).subarray(0, cur.length)); S.M._gba_reset(); note('save loaded (' + from + ')'); }
        };
        if (handle && handle.queryPermission) {
          return handle.queryPermission({ mode: 'readwrite' }).then(function(state) {
            if (state === 'granted') {
              S.fileHandle = handle;
              return handle.getFile().then(function(f) { return f.size ? f.arrayBuffer() : null; })
                .then(function(buf) { restore(buf || saved, buf ? handle.name : 'browser'); });
            }
            S.pendingHandle = handle;                       // needs a click: offered in the menu
            restore(saved, 'browser');
          }).catch(function() { restore(saved, 'browser'); });
        }
        restore(saved, 'browser');
      }).then(function() {
        if (audio) audio.clear();
        closeMenu();
        S.g.paused = false;
        ctx.printLine('gba: ' + (name || info.title) + ' — ' + info.title, 'term-out-bold');
      });
    }

    // ── menu (HTML overlay inside the terminal window) ──
    var menu = document.createElement('div');
    menu.className = 'gba-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'GBA emulator');
    var screen = 'home', library = null, dl = null;

    function h(tag, cls, text, attrs) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      if (attrs) Object.keys(attrs).forEach(function(k) { e.setAttribute(k, attrs[k]); });
      return e;
    }
    function btn(text, onClick, cls) {
      var b = h('button', 'gba-mbtn' + (cls ? ' ' + cls : ''), text, { type: 'button' });
      b.addEventListener('click', onClick);
      return b;
    }
    function row(label, control) {
      var r = h('label', 'gba-row');
      r.appendChild(h('span', null, label));
      r.appendChild(control);
      return r;
    }
    function check(key, onChange) {
      var c = h('input', null, null, { type: 'checkbox' });
      c.checked = !!settings[key];
      c.addEventListener('change', function() { settings[key] = c.checked; saveSettings(); if (onChange) onChange(); });
      return c;
    }
    function select(key, options, onChange) {
      var s = h('select');
      options.forEach(function(o) { var op = h('option', null, o[1], { value: String(o[0]) }); if (settings[key] === o[0]) op.selected = true; s.appendChild(op); });
      s.addEventListener('change', function() { settings[key] = typeof settings[key] === 'number' ? +s.value : s.value; saveSettings(); if (onChange) onChange(); });
      return s;
    }

    function render() {
      menu.replaceChildren();
      var box = h('div', 'gba-menu-box');
      menu.appendChild(box);
      var head = h('div', 'gba-menu-head');
      head.appendChild(h('strong', null, S.running ? '🎮 ' + S.info.title : '🎮 Game Boy Advance'));
      head.appendChild(btn('✕', function() { if (S.running) resume(); else window.Terminal.ctx.stopGame(); }, 'gba-close'));
      box.appendChild(head);
      var body = h('div', 'gba-menu-body');
      box.appendChild(body);

      if (screen === 'progress') { renderProgress(body); return; }
      if (screen === 'settings') { renderSettings(body); return; }

      if (S.running) {
        var g1 = h('div', 'gba-grid');
        g1.appendChild(btn('▶ Resume', resume, 'is-primary'));
        g1.appendChild(btn('💾 Save state', function() { quickSave(); resume(); }));
        g1.appendChild(btn('📂 Load state', function() { quickLoad(); resume(); }));
        g1.appendChild(btn('↺ Reset', function() { S.M._gba_reset(); resume(); }));
        body.appendChild(g1);
        body.appendChild(h('h4', null, 'Game save (.sav)'));
        var g2 = h('div', 'gba-grid');
        g2.appendChild(btn('⬇ Download .sav', function() { var s = sram(); if (s) saveBlob(s.slice(), fileName(S.info.title) + '.sav'); else note('this game has no save memory'); }));
        g2.appendChild(btn('⬆ Import .sav', function() { pickFile('.sav,.srm').then(function(f) { if (f) f.arrayBuffer().then(function(b) { importSave(new Uint8Array(b)); render(); }); }); }));
        if (window.showSaveFilePicker) {
          if (S.pendingHandle) g2.appendChild(btn('🔗 Use ' + S.pendingHandle.name, function() {
            var hd = S.pendingHandle;
            hd.requestPermission({ mode: 'readwrite' }).then(function(st) {
              if (st !== 'granted') return;
              S.fileHandle = hd; S.pendingHandle = null;
              return hd.getFile().then(function(f) { return f.arrayBuffer(); }).then(function(b) { if (b.byteLength) importSave(new Uint8Array(b)); render(); });
            });
          }));
          g2.appendChild(btn(S.fileHandle ? '🔗 Saving to ' + S.fileHandle.name : '🔗 Keep the save in a file on this PC…', linkSaveFile));
          if (S.fileHandle) g2.appendChild(btn('Unlink the file', function() { S.fileHandle = null; del('fsh:' + S.info.id); render(); }));
        }
        body.appendChild(g2);
        body.appendChild(h('p', 'gba-muted', S.fileHandle
          ? 'The save is written to “' + S.fileHandle.name + '” on this computer every few seconds, and kept in this browser.'
          : 'The save is kept automatically in this browser. Download it — or link a file — to keep it on your computer.'));
        body.appendChild(h('h4', null, 'Other game'));
      }

      var g3 = h('div', 'gba-grid');
      g3.appendChild(btn('📂 ROM from this computer…', function() {
        pickFile('.gba,.agb,.bin,.zip').then(function(f) { if (f) readLocal(f); });
      }, S.running ? '' : 'is-primary'));
      var settingsBtn = btn('⚙ Settings', function() { screen = 'settings'; render(); });
      g3.appendChild(settingsBtn);
      if (!S.running) get('lastrom').then(function(r) {
        if (r && r.data && !S.running && g3.isConnected) g3.insertBefore(btn('▶ Continue: ' + r.name, function() { start(new Uint8Array(r.data), r.name); }), settingsBtn);
      });
      body.appendChild(g3);

      if (libraryUrl) renderLibrary(body);
      body.appendChild(h('p', 'gba-muted gba-foot', 'Runs entirely in your browser — nothing is uploaded. You can also drop a .gba, .zip or .sav file on the terminal. gpSP (GPL-2.0) with its open-source BIOS.'));
    }

    function renderLibrary(body) {
      body.appendChild(h('h4', null, 'Library'));
      var list = h('div', 'gba-library');
      body.appendChild(list);
      if (!library) {
        list.appendChild(h('p', 'gba-muted', 'Loading the list…'));
        var url = sameOrigin(libraryUrl);
        (url ? fetch(url, { credentials: 'same-origin', cache: 'no-cache' }).then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
             : Promise.reject(new Error('the library must be on this site')))
          .then(function(j) {
            var arr = Array.isArray(j) ? j : (j && j.roms) || [];
            library = arr.filter(function(x) { return x && x.file; }).map(function(x) {
              return { name: String(x.name || x.file), file: sameOrigin(new URL(String(x.file), url).href), size: +x.size || 0, info: String(x.info || '') };
            }).filter(function(x) { return x.file; });
          }).catch(function() { library = []; })
          .then(function() { if (screen === 'home' && menu.classList.contains('is-open')) render(); });
        return;
      }
      if (!library.length) { list.appendChild(h('p', 'gba-muted', 'No ROM available on this site.')); return; }
      var filter = h('input', 'gba-filter', null, { type: 'search', placeholder: 'Filter ' + library.length + ' games…', 'aria-label': 'Filter the library' });
      list.appendChild(filter);
      var ul = h('ul');
      library.forEach(function(x) {
        var li = h('li');
        var b = btn('', function() { fetchRom(x); }, 'gba-lib-item');
        b.appendChild(h('span', 'gba-lib-name', x.name));
        b.appendChild(h('span', 'gba-muted', [x.info, x.size ? fmtSize(x.size) : ''].filter(Boolean).join(' · ')));
        li.appendChild(b); ul.appendChild(li);
      });
      list.appendChild(ul);
      filter.addEventListener('input', function() {
        var q = filter.value.toLowerCase();
        Array.prototype.forEach.call(ul.children, function(li, i) { li.hidden = !!q && library[i].name.toLowerCase().indexOf(q) === -1; });
      });
    }

    function renderProgress(body) {
      body.appendChild(h('p', 'gba-progress-title', 'Downloading ' + dl.name));
      var bar = h('div', 'gba-progress'), fill = h('div', 'gba-progress-fill');
      bar.appendChild(fill);
      var txt = h('p', 'gba-muted gba-progress-text', '');
      dl.update = function(got, total) {
        fill.classList.toggle('is-indeterminate', !total);
        fill.style.width = total ? Math.min(100, got / total * 100).toFixed(1) + '%' : '';
        var el = (performance.now() - dl.t0) / 1000;
        txt.textContent = (total ? Math.floor(got / total * 100) + ' % · ' : '') + fmtSize(got) + (total ? ' / ' + fmtSize(total) : '') +
                          (el > 0.3 && got ? ' · ' + fmtSize(got / el) + '/s' : '');
      };
      body.appendChild(bar); body.appendChild(txt);
      body.appendChild(btn('Cancel', function() { dl.ctrl.abort(); }));
      dl.update(0, dl.size || 0);
    }

    function renderSettings(body) {
      body.appendChild(h('h4', null, 'Controls'));
      body.appendChild(h('p', 'gba-muted', 'Click a control, then press the key to use (Esc cancels).'));
      var grid = h('div', 'gba-binds');
      ACTIONS.forEach(function(a) {
        var b = btn(S.capture === a[0] ? 'press a key…' : keyLabel(settings.keys[a[0]]), function(e) { e.preventDefault(); S.capture = a[0]; render(); }, 'gba-bind' + (S.capture === a[0] ? ' is-capturing' : ''));
        grid.appendChild(row(a[1], b));
      });
      body.appendChild(grid);
      body.appendChild(btn('Reset controls', function() { settings.keys = JSON.parse(JSON.stringify(DEFAULTS.keys)); saveSettings(); render(); }));

      body.appendChild(h('h4', null, 'Video'));
      var relayout = function() { if (S.g && S.g.relayout) S.g.relayout(); };
      var core = function() { if (S.M) applyCoreOptions(S.M); };
      body.appendChild(row('Smoothing (anti-aliasing)', check('smooth')));
      body.appendChild(row('Pixel-perfect scaling (whole multiples)', check('integer', relayout)));
      body.appendChild(row('Scanlines', select('scanlines', [[0, 'Off'], [1, 'Light'], [2, 'Strong']])));
      body.appendChild(row('GBA screen colours (colour correction)', check('color', core)));
      body.appendChild(row('Frame blending (smooths flicker effects)', check('blend', core)));
      body.appendChild(row('Show FPS', check('fps')));

      body.appendChild(h('h4', null, 'Audio & speed'));
      var vol = h('input', null, null, { type: 'range', min: '0', max: '1', step: '0.05' });
      vol.value = String(settings.volume);
      vol.addEventListener('input', function() { settings.volume = +vol.value; saveSettings(); if (audio) audio.volume(); });
      body.appendChild(row('Volume', vol));
      body.appendChild(row('Mute', check('mute', function() { if (audio) audio.volume(); })));
      body.appendChild(row('Fast-forward speed', select('ffSpeed', [[2, '×2'], [3, '×3'], [4, '×4'], [6, '×6']])));
      body.appendChild(btn('← Back', function() { screen = 'home'; S.capture = null; render(); }, 'is-primary'));
    }

    function showMenu(scr) {
      screen = scr || 'home';
      if (S.g) S.g.paused = true;
      if (audio && S.running) audio.clear();
      render();
      menu.classList.add('is-open');
      var first = menu.querySelector('.is-primary') || menu.querySelector('.gba-menu-body button');
      if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
    }
    function closeMenu() { menu.classList.remove('is-open'); S.capture = null; }
    function resume() { if (!S.running) return; closeMenu(); S.g.paused = false; if (audio) audio.resume(); }

    function quickSave() {
      if (S.M._gba_state_save()) { put('state:' + S.info.id, S.M.HEAPU8.slice(S.M._gba_state_ptr(), S.M._gba_state_ptr() + S.M._gba_state_size()).buffer); note('state saved'); }
    }
    function quickLoad() {
      get('state:' + S.info.id).then(function(st) {
        if (!st) { note('no saved state'); return; }
        S.M.HEAPU8.set(new Uint8Array(st).subarray(0, S.M._gba_state_size()), S.M._gba_state_ptr());
        note(S.M._gba_state_load() ? 'state loaded' : 'state failed');
      });
    }

    function fail(e) {
      var msg = String((e && e.message) || e);
      note(msg);
      ctx.printLine('gba: ' + msg, 'term-out-error');
      if (/WebAssembly|CompileError|unsafe-eval/i.test(msg)) ctx.printLine('gba: this page does not allow WebAssembly (Content-Security-Policy)', 'term-out-dim');
      screen = 'home';
      if (!menu.classList.contains('is-open')) showMenu(); else render();
    }
    function start(bytes, name) { return loadRom(bytes, name).catch(fail); }
    function readLocal(f) {
      if (/\.(sav|srm)$/i.test(f.name)) { f.arrayBuffer().then(function(b) { importSave(new Uint8Array(b)); if (menu.classList.contains('is-open')) render(); }); return; }
      if (!/\.(gba|agb|bin|mb|zip)$/i.test(f.name)) { fail('expected a .gba or .zip file'); return; }
      if (f.size > MAX_ROM * 2) { fail('file too large for a GBA ROM'); return; }
      f.arrayBuffer().then(function(b) { start(new Uint8Array(b), f.name); });
    }
    function fetchRom(x) {
      dl = { name: x.name, size: x.size, ctrl: new AbortController(), t0: performance.now(), update: function() {} };
      screen = 'progress'; render();
      download(x.file, function(got, total) { dl.update(got, total || x.size); }, dl.ctrl.signal)
        .then(function(bytes) { return start(bytes, x.file.split('/').pop()); })
        .catch(function(e) { if (e && e.name === 'AbortError') { screen = 'home'; render(); } else fail(e); });
    }
    S.showMenu = showMenu; S.start = start; S.readLocal = readLocal;

    // Keys while the menu is open: handled here, before the game engine sees them
    function onMenuKey(e) {
      if (!menu.classList.contains('is-open')) return;
      if (S.capture) {
        e.preventDefault(); e.stopPropagation();
        if (e.key !== 'Escape') { settings.keys[S.capture] = e.code || e.key; saveSettings(); }
        S.capture = null; render();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (screen !== 'home' && screen !== 'progress') { screen = 'home'; render(); }
        else if (S.running) resume(); else window.Terminal.ctx.stopGame();
        return;
      }
      if (e.code === settings.keys.menu && S.running) { e.preventDefault(); e.stopPropagation(); resume(); return; }
      e.stopPropagation();          // Tab / Enter / Space / arrows drive the menu, not the game
    }
    function onMenuKeyUp(e) { if (menu.classList.contains('is-open')) e.stopPropagation(); }
    window.addEventListener('keydown', onMenuKey, true);
    window.addEventListener('keyup', onMenuKeyUp, true);

    // ── game engine ──
    function bound(code, key) {
      var k = settings.keys;
      for (var a in k) if (k[a] === code) return a;
      if (!code && /^Arrow/.test(key)) return key.slice(5).toLowerCase();   // touch swipes
      return null;
    }
    S.g = ctx.createGame({
      name: 'gba', title: '🎮 GBA', controls: keyLabel(settings.keys.menu) + ' menu · gba help for the keys',
      width: W, height: H, pauseOverlay: false,
      integerScale: function() { return settings.integer; },
      keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Backspace', ' ', 'F1', 'F2', 'F4', 'Tab'],

      init: function(g) {
        if (win) win.appendChild(menu);
        if (ctx.isTouch() && win) S.pad = touchPad(win, setBit, function() { showMenu(); });
        showMenu(opts.screen);
        if (opts.rom) start(opts.rom.data, opts.rom.name);
      },

      onKey: function(g, key, down, e) {
        if (!S.running) return;
        var a = bound(e && e.code, key);
        if (!a) return;
        if (e && e.preventDefault) e.preventDefault();
        if (a === 'fast') { S.fast = down; return; }
        if (!down) { if (BIT[a] != null) setBit(BIT[a], false); return; }
        if (a === 'menu') { showMenu(); return; }
        if (a === 'save') { quickSave(); return; }
        if (a === 'load') { quickLoad(); return; }
        if (BIT[a] != null) setBit(BIT[a], true);
      },

      update: function(g, dt) {
        if (S.toastT > 0) S.toastT -= dt;
        if (!S.running) return;
        var speed = S.fast ? settings.ffSpeed : 1;
        S.acc += dt * speed;
        var n = 0;
        while (S.acc >= S.frameTime && n < speed + 1) {
          S.M._gba_run_frame(); S.acc -= S.frameTime; n++; S.fpsCount++;
          if (audio && !S.fast) audio.push(S.M.HEAP16, S.M._gba_audio_ptr(), S.M._gba_audio_frames());
        }
        if (S.acc > S.frameTime * 4) S.acc = 0;
        if ((S.fpsT += dt) >= 1) { S.fps = S.fpsCount / S.fpsT; S.fpsCount = 0; S.fpsT = 0; }
        if ((S.saveTimer += dt) > 3) { S.saveTimer = 0; persistSram(false); }
      },

      render: function(c, g) {
        if (S.running) {
          var fp = S.M._gba_frame_ptr() >> 1, src = S.M.HEAPU16;
          for (var i = 0; i < W * H; i++) pix[i] = table[src[fp + i]];
          octx.putImageData(img, 0, 0);
          c.imageSmoothingEnabled = !!settings.smooth;
          c.imageSmoothingQuality = 'high';
          c.drawImage(off, 0, 0, W, H);
          if (settings.scanlines) {
            c.fillStyle = settings.scanlines === 2 ? 'rgba(0,0,0,.32)' : 'rgba(0,0,0,.16)';
            for (var y = 0; y < H; y++) c.fillRect(0, y + 0.55, W, 0.45);
          }
        } else {
          c.fillStyle = '#0a1020'; c.fillRect(0, 0, W, H);
          c.fillStyle = g.color(0.9); c.font = 'bold 20px "JetBrains Mono", monospace'; c.textAlign = 'center';
          c.fillText('GAME BOY ADVANCE', W / 2, H / 2 - 4);
          c.fillStyle = 'rgba(230,237,243,.6)'; c.font = '9px "JetBrains Mono", monospace';
          c.fillText('choose a game in the menu', W / 2, H / 2 + 14);
          c.textAlign = 'left';
        }
        c.font = '9px "JetBrains Mono", monospace';
        if (settings.fps && S.running) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(2, 2, 46, 12); c.fillStyle = '#7ee787'; c.fillText(S.fps.toFixed(1) + ' fps', 5, 11); }
        if (S.fast && S.running) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(W - 32, 2, 30, 12); c.fillStyle = '#fff'; c.fillText('▶▶ ×' + settings.ffSpeed, W - 30, 11); }
        if (g.paused && S.running && !menu.classList.contains('is-open')) {
          c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, W, H);
          c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = 'bold 16px "JetBrains Mono", monospace';
          c.fillText('PAUSED', W / 2, H / 2); c.font = '9px "JetBrains Mono", monospace';
          c.fillText('P to resume · ' + keyLabel(settings.keys.menu) + ' for the menu', W / 2, H / 2 + 14);
          c.textAlign = 'left';
        }
        if (S.toastT > 0) {
          c.fillStyle = 'rgba(0,0,0,.65)'; c.fillRect(0, H - 15, W, 15);
          c.fillStyle = '#fff'; c.fillText(S.toast, 4, H - 4);
        }
        if (audio) { var p = g.paused || !S.running; if (p !== audio.paused) { audio.paused = p; if (p) audio.ctx.suspend(); else audio.resume(); } }
      },

      exit: function() {
        persistSram(true);
        if (audio) { audio.clear(); audio.ctx.suspend(); audio.paused = true; }
        if (S.pad && S.pad.parentNode) S.pad.parentNode.removeChild(S.pad);
        if (menu.parentNode) menu.parentNode.removeChild(menu);
        window.removeEventListener('keydown', onMenuKey, true);
        window.removeEventListener('keyup', onMenuKeyUp, true);
        window.removeEventListener('pagehide', onHide);
        if (S.M) S.M._gba_set_keys(0);
        session = null;
      }
    });
    function onHide() { persistSram(true); }
    window.addEventListener('pagehide', onHide);
  }

  // ── Touch pad ────────────────────────────────────────────────────────────
  function touchPad(host, setBit, onMenu) {
    var pad = document.createElement('div');
    pad.className = 'gba-pad';
    pad.setAttribute('aria-hidden', 'true');
    [['L', BIT.l, 'gba-l'], ['R', BIT.r, 'gba-r'], ['▲', BIT.up, 'gba-up'], ['◀', BIT.left, 'gba-left'], ['▶', BIT.right, 'gba-right'], ['▼', BIT.down, 'gba-down'],
     ['B', BIT.b, 'gba-b'], ['A', BIT.a, 'gba-a'], ['SELECT', BIT.select, 'gba-select'], ['START', BIT.start, 'gba-start'], ['☰', -1, 'gba-menu-btn']].forEach(function(b) {
      var e = document.createElement('button');
      e.type = 'button'; e.className = 'gba-btn ' + b[2]; e.textContent = b[0]; e.setAttribute('data-bit', b[1]);
      pad.appendChild(e);
    });
    function handle(e, down) {
      var t = e.target.closest && e.target.closest('[data-bit]');
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      var bit = +t.getAttribute('data-bit');
      if (bit < 0) { if (down) onMenu(); return; }
      setBit(bit, down);
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

  // ── Drag & drop on the terminal ──────────────────────────────────────────
  var term = document.getElementById('hero-terminal');
  if (term) {
    term.addEventListener('dragover', function(e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); term.classList.add('is-dropping'); }
    });
    term.addEventListener('dragleave', function() { term.classList.remove('is-dropping'); });
    term.addEventListener('drop', function(e) {
      term.classList.remove('is-dropping');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      e.preventDefault();
      if (!session) openEmulator(window.Terminal.ctx);
      if (session) session.readLocal(f);
    });
  }

  window.Terminal.register({
    name: 'gba',
    aliases: ['gameboy'],
    help: ['gba [last|settings]', 'Game Boy Advance emulator', 'games'],
    touch: { none: true },
    run: function(args, ctx) {
      var sub = (args[0] || '').toLowerCase();
      if (sub !== 'help') ensureAudio();                 // needs this key press (autoplay rules)
      if (sub === 'help') {
        var k = settings.keys;
        ctx.printLines([
          'Game Boy Advance emulator — gpSP compiled to WebAssembly (GPL-2.0), open-source BIOS',
          '  gba            menu: ' + (libraryUrl ? 'ROM library, ' : '') + 'ROM from your computer, settings',
          '  gba last       reload the last ROM',
          '  gba settings   controls, video, audio',
          'Everything runs in your browser: nothing is uploaded.',
          'Keys: arrows · ' + keyLabel(k.a) + ' = A · ' + keyLabel(k.b) + ' = B · ' + keyLabel(k.l) + ' / ' + keyLabel(k.r) + ' = L / R · ' +
            keyLabel(k.start) + ' = Start · ' + keyLabel(k.select) + ' = Select',
          '      ' + keyLabel(k.fast) + ' (hold) = fast forward · ' + keyLabel(k.save) + ' / ' + keyLabel(k.load) + ' = save / load state · ' +
            keyLabel(k.menu) + ' = menu · Esc = quit',
          'Saves: kept in this browser; download / import .sav or link a .sav file on your PC from the menu.'
        ], 'term-out');
        return;
      }
      if (sub === 'last') {
        get('lastrom').then(function(r) {
          if (!r || !r.data) { ctx.printLine('gba: no previous ROM in this browser — type gba', 'term-out-dim'); return; }
          openEmulator(ctx, { rom: { data: new Uint8Array(r.data), name: r.name } });
        });
        return;
      }
      openEmulator(ctx, { screen: sub === 'settings' ? 'settings' : 'home' });
    }
  });
})();
