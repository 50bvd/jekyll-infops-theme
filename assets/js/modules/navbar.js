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

    const setOpen = open => {
      menu.classList.toggle('active', open);
      toggle.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
    };

    toggle.addEventListener('click', () => setOpen(!menu.classList.contains('active')));

    document.addEventListener('click', e => {
      if (!toggle.contains(e.target) && !menu.contains(e.target)) setOpen(false);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.classList.contains('active')) { setOpen(false); toggle.focus(); }
    });

    // Close when switching back to desktop layout
    const mq = window.matchMedia('(min-width: 769px)');
    const onMq = () => { if (mq.matches) setOpen(false); };
    mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq);

    menu.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => setOpen(false)));
  });
})();
