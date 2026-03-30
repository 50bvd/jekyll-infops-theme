/**
 * modules/navbar.js — Mobile hamburger menu toggle
 * Closes menu on outside click and on nav-link click.
 */
'use strict';
(function initNavbar() {
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.navbar-toggle');
    const menu   = document.querySelector('.navbar-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('active');
      toggle.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', e => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('active');
        toggle.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    menu.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => {
      menu.classList.remove('active');
      toggle.classList.remove('active');
    }));
  });
})();
