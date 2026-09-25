/**
 * modules/goatcounter-widget.js — "Visitors / month" stat (GoatCounter).
 * The GoatCounter code comes from data-goatcounter on #stat-visitors.
 * External file (not inline) so it keeps working under a strict CSP.
 */
'use strict';
(function() {
  'use strict';
  var el   = document.getElementById('stat-visitors');
  var code = el && el.getAttribute('data-goatcounter');
  if (!el || !code || code.indexOf('YOUR') !== -1 || !/^[a-z0-9-]+$/i.test(code)) return;

  // GoatCounter expose les stats publiques via un endpoint JSON sans auth
  // si "Allow public access to stats" est activé dans Settings.
  // Sinon on tente quand même — les erreurs CORS sont silencieuses.
  var now   = new Date();
  var start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  var fmt   = function(d) {
    return d.getFullYear() + '-'
      + String(d.getMonth() + 1).padStart(2, '0') + '-'
      + String(d.getDate()).padStart(2, '0');
  };

  el.innerHTML = '<span class="stat-loading" aria-hidden="true"></span>';

  fetch('https://' + code + '.goatcounter.com/api/v0/stats/total'
      + '?start=' + fmt(start) + '&end=' + fmt(now), {
    headers: { 'Accept': 'application/json' }
  })
  .then(function(r) {
    if (r.status === 403) return Promise.reject('auth-required');
    if (!r.ok)           return Promise.reject('http-' + r.status);
    return r.json();
  })
  .then(function(d) {
    var v = typeof d.total_unique === 'number' ? d.total_unique
          : typeof d.total        === 'number' ? d.total : 0;
    el.textContent = v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v > 0 ? String(v) : '—';
  })
  .catch(function(err) {
    // 403 = stats non publiques, afficher lien vers dashboard
    if (err === 'auth-required') {
      var link = document.createElement('a');
      link.href = 'https://' + code + '.goatcounter.com';
      link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.className = 'stat-link';
      link.title = 'Enable public stats in GoatCounter settings';
      link.textContent = 'View →';
      el.textContent = ''; el.appendChild(link);
    } else {
      el.textContent = '—';
    }
    console.info('[infops] GoatCounter stats:', err,
      '→ Enable "Allow public access" in GoatCounter Settings to show visitor count.');
  });
})();
