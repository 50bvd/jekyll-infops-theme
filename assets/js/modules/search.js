/**
 * modules/search.js — Client-side full-text search
 * Reads search.json URL from <meta name="search-json-url"> in <head>.
 */
'use strict';
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var searchInput   = document.getElementById('search-input');
    var resultsDiv    = document.getElementById('search-results');
    var countEl       = document.getElementById('result-count');

    // Only run on the search page
    if (!searchInput || !resultsDiv) return;

    // Get JSON URL from meta tag (set by Jekyll in default.html)
    var meta    = document.querySelector('meta[name="search-json-url"]');
    var jsonUrl = (meta && meta.getAttribute('content')) || '/search.json';

    var posts  = [];
    var ready  = false;
    var error  = false;

    // ── Load search index ──────────────────────────────────────────────────
    function loadIndex(cb) {
      if (ready)  { cb(); return; }
      if (error)  { return; }

      fetch(jsonUrl)
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function(data) {
          // Normalise once (lower case, no accents) instead of on every keystroke
          posts = (Array.isArray(data) ? data : []).map(function(p) {
            var title = norm(p.title), tags = norm(p.tags);
            return { p: p, title: title, tags: tags,
                     hay: [title, tags, norm(p.categories), norm(p.excerpt), norm(p.content)].join(' ') };
          });
          ready = true;
          cb();
        })
        .catch(function(err) {
          error = true;
          console.error('[search] Failed to load ' + jsonUrl + ':', err);
          var home = (document.querySelector('.navbar-brand a') || {}).href || '/';
          resultsDiv.innerHTML =
            '<div class="no-results">' +
            '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>' +
            '<p>Search index unavailable. <a href="' + esc(home) + '">Return home</a>.</p>' +
            '</div>';
        });
    }

    // ── Escape HTML ────────────────────────────────────────────────────────
    function esc(s) {
      return String(s || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    function norm(s) {
      s = String(s || '').toLowerCase();
      return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
    }

    function safeUrl(u) {
      // Only same-site relative paths or http(s) URLs end up in href
      u = String(u || '');
      return /^(\/|https?:\/\/)/i.test(u) ? u : '#';
    }

    // ── Run search ─────────────────────────────────────────────────────────
    function runSearch(q) {
      q = (q || '').trim();

      if (!q) {
        resultsDiv.innerHTML = '';
        if (countEl) countEl.textContent = '';
        return;
      }

      // Every word must match (AND), accents ignored; title hits ranked first
      var terms = norm(q).split(/\s+/).filter(Boolean);

      var hits = posts.map(function(e) {
        if (!terms.every(function(t) { return e.hay.indexOf(t) !== -1; })) return null;
        var score = terms.reduce(function(s, t) { return s + (e.title.indexOf(t) !== -1 ? 10 : 0) + (e.tags.indexOf(t) !== -1 ? 3 : 0); }, 0);
        return { p: e.p, score: score };
      }).filter(Boolean).sort(function(a, b) { return b.score - a.score; })
        .map(function(h) { return h.p; });

      if (countEl) {
        countEl.innerHTML =
          '<strong>' + hits.length + '</strong> result' +
          (hits.length !== 1 ? 's' : '') +
          ' for "<strong>' + esc(q) + '</strong>"';
      }

      if (!hits.length) {
        resultsDiv.innerHTML =
          '<div class="no-results">' +
          '<i class="fas fa-search" aria-hidden="true"></i>' +
          '<p>No results found for <strong>' + esc(q) + '</strong>.</p>' +
          '</div>';
        return;
      }

      resultsDiv.innerHTML = hits.map(function(p) {
        return '<article class="post-card fade-in">' +
          '<div class="post-meta">' +
          '<span><i class="fas fa-calendar" aria-hidden="true"></i> ' + esc(p.date) + '</span>' +
          (p.tags ? '<span><i class="fas fa-tag" aria-hidden="true"></i> ' + esc(p.tags) + '</span>' : '') +
          '</div>' +
          '<h2 class="post-title"><a href="' + esc(safeUrl(p.url)) + '">' + esc(p.title) + '</a></h2>' +
          (p.excerpt ? '<p class="post-excerpt">' + esc(p.excerpt) + '</p>' : '') +
          '<a href="' + esc(safeUrl(p.url)) + '" class="read-more">' +
          'Read more <i class="fas fa-arrow-right" aria-hidden="true"></i>' +
          '</a>' +
          '</article>';
      }).join('');
      if (typeof window.InfOpsReveal === 'function') window.InfOpsReveal(resultsDiv);
    }

    // ── Debounced live search ──────────────────────────────────────────────
    var debounceTimer;
    searchInput.addEventListener('input', function() {
      var val = searchInput.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        loadIndex(function() { runSearch(val); });
        // Keep ?q= in the URL so results can be shared / survive a reload
        try {
          var u = new URL(window.location.href);
          if (val.trim()) u.searchParams.set('q', val.trim()); else u.searchParams.delete('q');
          history.replaceState(null, '', u);
        } catch (e) {}
      }, 200);
    });

    // ── Pre-fill from ?q= URL param (navbar form submission) ──────────────
    var params = new URLSearchParams(window.location.search);
    var urlQ   = params.get('q');
    if (urlQ) {
      searchInput.value = urlQ;
      loadIndex(function() { runSearch(urlQ); });
    }

    // Focus the input (without jumping the page)
    try { searchInput.focus({ preventScroll: true }); } catch (e) { searchInput.focus(); }
  });
})();
