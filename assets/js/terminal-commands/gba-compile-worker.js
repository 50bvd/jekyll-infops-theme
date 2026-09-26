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
  fetch(e.data)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then(function(b) { return WebAssembly.compile(b); })
    .then(function(m) { self.postMessage({ module: m }); },
          function(err) { self.postMessage({ error: String((err && err.message) || err) }); });
};
