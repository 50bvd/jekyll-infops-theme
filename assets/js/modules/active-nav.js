/**
 * modules/active-nav.js — Active nav link highlighting
 *
 * Paths are compared relative to the site baseurl (read from the brand link),
 * so the rules below also hold when the site lives in a sub-folder
 * (e.g. GitHub Pages project sites: /jekyll-infops-theme/…).
 *
 * Rules:
 *   - Exact match:   href === current path  → always active
 *   - Home ("/"):    active only on paginator paths (/page2/, /page3/)
 *   - Other sections (/archives/, /tags/…): active if path starts with href+"/"
 *     BUT never on date-based post URLs (/2025/01/02/title/)
 */
'use strict';
(function initActiveNav() {
  document.addEventListener('DOMContentLoaded', () => {
    const normalize = s => (s || '/').replace(/\/+$/, '') || '/';
    const brand = document.querySelector('.navbar-brand a');
    const base  = brand ? normalize(new URL(brand.href, location.href).pathname) : '/';
    const strip = p => {
      p = normalize(p);
      if (base !== '/' && (p === base || p.startsWith(base + '/'))) p = p.slice(base.length) || '/';
      return p;
    };
    const path = strip(location.pathname);

    document.querySelectorAll('.nav-link').forEach(link => {
      const url = new URL(link.getAttribute('href') || '/', location.href);
      if (url.origin !== location.origin) return;           // external links
      const href = strip(url.pathname);
      let active = false;

      if (href === path) {
        active = true;
      } else if (href === '/') {
        active = /^\/page\d+$/.test(path);
      } else if (path.startsWith(href + '/')) {
        active = !/^\/\d{4}(\/|$)/.test(path);
      }

      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
    });
  });
})();
