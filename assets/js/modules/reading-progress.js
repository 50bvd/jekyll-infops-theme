/**
 * modules/reading-progress.js — Reading progress bar
 * Fills .reading-progress-bar width as the user scrolls through a post.
 */
'use strict';
(function initReadingProgress() {
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.querySelector('.reading-progress-bar');
    if (!bar) return;
    const update = () => {
      const d = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (d > 0 ? Math.min((window.scrollY / d) * 100, 100) : 0) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
  });
})();
