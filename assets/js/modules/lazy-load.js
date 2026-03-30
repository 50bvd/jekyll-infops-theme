/**
 * modules/lazy-load.js — Lazy loading for images
 * Images with data-src attribute are loaded only when they enter the viewport.
 * Use: <img data-src="/path/to/image.jpg" alt="...">
 */
'use strict';
(function initLazyLoad() {
  document.addEventListener('DOMContentLoaded', () => {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver((entries, o) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const img = e.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        img.classList.add('loaded');
        o.unobserve(img);
      });
    }, { rootMargin: '200px' });
    document.querySelectorAll('img[data-src]').forEach(img => obs.observe(img));
  });
})();
