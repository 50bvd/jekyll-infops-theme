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
          posts = Array.isArray(data) ? data : [];
          ready = true;
          cb();
        })
        .catch(function(err) {
          error = true;
          console.error('[search] Failed to load ' + jsonUrl + ':', err);
          resultsDiv.innerHTML =
            '<div class="no-results">' +
            '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>' +
            '<p>Search index unavailable. <a href="/">Return home</a>.</p>' +
            '</div>';
        });
    }

    // ── Escape HTML ────────────────────────────────────────────────────────
    function esc(s) {
      return String(s || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Run search ─────────────────────────────────────────────────────────
    function runSearch(q) {
      q = (q || '').trim();

      if (!q) {
        resultsDiv.innerHTML = '';
        if (countEl) countEl.textContent = '';
        return;
      }

      var ql = q.toLowerCase();

      var hits = posts.filter(function(p) {
        return [p.title, p.content, p.tags, p.categories, p.excerpt]
          .filter(Boolean)
          .some(function(field) {
            return field.toLowerCase().indexOf(ql) !== -1;
          });
      });

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
          '<h2 class="post-title"><a href="' + esc(p.url) + '">' + esc(p.title) + '</a></h2>' +
          (p.excerpt ? '<p class="post-excerpt">' + esc(p.excerpt) + '</p>' : '') +
          '<a href="' + esc(p.url) + '" class="read-more">' +
          'Read more <i class="fas fa-arrow-right" aria-hidden="true"></i>' +
          '</a>' +
          '</article>';
      }).join('');
    }

    // ── Debounced live search ──────────────────────────────────────────────
    var debounceTimer;
    searchInput.addEventListener('input', function() {
      var val = searchInput.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        loadIndex(function() { runSearch(val); });
      }, 200);
    });

    // ── Pre-fill from ?q= URL param (navbar form submission) ──────────────
    var params = new URLSearchParams(window.location.search);
    var urlQ   = params.get('q');
    if (urlQ) {
      searchInput.value = urlQ;
      loadIndex(function() { runSearch(urlQ); });
    }

    // Focus the input
    searchInput.focus();
  });
})();
