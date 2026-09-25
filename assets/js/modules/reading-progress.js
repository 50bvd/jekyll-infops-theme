/**
 * modules/reading-progress.js — Reading progress bar
 * Scales .reading-progress-bar (transform: scaleX — GPU, no layout) as the user
 * scrolls through a post. Updates are batched with requestAnimationFrame.
 */
'use strict';
(function initReadingProgress() {
  document.addEventListener('DOMContentLoaded', () => {
    const bar = document.querySelector('.reading-progress-bar');
    if (!bar) return;
    bar.style.width = '100%';
    bar.style.transformOrigin = '0 50%';
    let ticking = false;
    const update = () => {
      ticking = false;
      const d = document.documentElement.scrollHeight - window.innerHeight;
      const p = d > 0 ? Math.min(window.scrollY / d, 1) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  });
})();
