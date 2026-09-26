/**
 * terminal-commands/gba-compile-worker.js — compiles the emulator's
 * WebAssembly for a page that is not allowed to.
 *
 * Some antivirus products (Kaspersky…) replace the page's Content-Security-
 * Policy with their own, without 'wasm-unsafe-eval', which forbids compiling
 * WebAssembly in the page. A worker is governed by the policy sent with its
 * own script (this file), which they leave alone: the module is compiled here
 * and handed back to the page, which only instantiates it (allowed).
 */
'use strict';
self.onmessage = function(e) {
  var url;
  try { url = new URL(String(e.data), self.location.href); } catch (err) { url = null; }
  // only the site's own emulator file, never another origin
  if (!url || url.origin !== self.location.origin || !/\.wasm$/.test(url.pathname)) {
    self.postMessage({ error: 'refused: not a same-origin .wasm URL' });
    return;
  }
  fetch(url.href, { credentials: 'same-origin' })
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then(function(b) { return WebAssembly.compile(b); })
    .then(function(m) { self.postMessage({ module: m }); },
          function(err) { self.postMessage({ error: String((err && err.message) || err) }); });
};
