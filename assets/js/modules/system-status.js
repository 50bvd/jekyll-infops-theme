/**
 * modules/system-status.js — "System Status" sidebar widget
 * Four real client-side metrics: network, page load time, protocol, JS heap.
 * External file (not inline) so it keeps working under a strict CSP.
 */
'use strict';
(function() {
  'use strict';
  var list = document.getElementById('live-status-list');
  if (!list) return;

  function icon(s) {
    var colors = { online: 'var(--status-success)', warning: 'var(--status-warning)', error: 'var(--status-error)' };
    return '<i class="fas fa-circle" style="color:' + (colors[s]||'var(--text-muted)') + '" aria-hidden="true"></i>';
  }
  function row(label, s, v) {
    return '<li class="status-item">'
      + '<span class="status-name">' + icon(s) + ' ' + label + '</span>'
      + '<span class="status-badge ' + s + '">' + v + '</span>'
      + '</li>';
  }

  // 1. Network connectivity + type
  function getNetwork() {
    if (!navigator.onLine) return { s: 'error', v: 'offline' };
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return { s: 'online', v: 'online' };
    var t = c.effectiveType || c.type || '';
    if (t === 'slow-2g' || t === '2g') return { s: 'warning', v: t };
    if (c.rtt && c.rtt > 400) return { s: 'warning', v: c.rtt + 'ms' };
    return { s: 'online', v: t || 'online' };
  }

  // 2. Page load performance (Navigation Timing Level 2, fallback Level 1)
  function getPageLoad() {
    if (!window.performance) return null;
    var ms = 0;
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (nav && nav.loadEventEnd > 0) ms = Math.round(nav.loadEventEnd - nav.startTime);
    else if (performance.timing && performance.timing.loadEventEnd > 0)
      ms = performance.timing.loadEventEnd - performance.timing.navigationStart;
    if (ms <= 0) return null;
    var v = ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
    return { s: ms < 2000 ? 'online' : ms < 5000 ? 'warning' : 'error', v: v };
  }

  // 3. Protocol
  function getProtocol() {
    return location.protocol === 'https:'
      ? { s: 'online',   v: 'HTTPS' }
      : { s: 'warning',  v: 'HTTP' };
  }

  // 4. Memory (JS heap) — Chrome only, skip if unavailable
  function getMemory() {
    if (!performance.memory) return null;
    var m     = performance.memory;
    var used  = Math.round(m.usedJSHeapSize  / 1048576);
    var total = Math.round(m.totalJSHeapSize / 1048576);
    // Health is measured against the heap *limit*, not the currently allocated size
    var pct   = m.jsHeapSizeLimit ? Math.round(m.usedJSHeapSize / m.jsHeapSizeLimit * 100) : 0;
    return { s: pct < 70 ? 'online' : pct < 90 ? 'warning' : 'error', v: used + 'MB / ' + total + 'MB' };
  }

  function render() {
    var html = '';
    var net  = getNetwork();   html += row('Network',   net.s,  net.v);
    var load = getPageLoad();  if (load) html += row('Load time', load.s, load.v);
    var proto = getProtocol(); html += row('Protocol',  proto.s, proto.v);
    var mem  = getMemory();    if (mem)  html += row('JS heap',   mem.s,  mem.v);

    list.innerHTML = html;
  }

  render();
  // Re-render once the load event has fired so "Load time" gets a value
  if (document.readyState !== 'complete') window.addEventListener('load', function() { setTimeout(render, 0); });
  setInterval(function() { if (!document.hidden) render(); }, 12000);
  window.addEventListener('online',  render);
  window.addEventListener('offline', render);
})();
