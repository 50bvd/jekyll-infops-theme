/**
 * modules/active-nav.js — Active nav link highlighting
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
    const normalize = s => (s || '/').replace(/\/$/, '') || '/';
    const path = normalize(window.location.pathname);

    document.querySelectorAll('.nav-link').forEach(link => {
      const href = normalize(link.getAttribute('href') || '/');
      let active = false;

      if (href === path) {
        active = true;
      } else if (href === '/') {
        active = /^\/page\d+$/.test(path);
      } else if (path.startsWith(href + '/')) {
        const isDatePath = /^\/\d{4}(\/|$)/.test(path);
        active = !isDatePath;
      }

      if (active) link.classList.add('active');
    });
  });
})();
