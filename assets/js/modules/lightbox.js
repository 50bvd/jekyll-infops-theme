/**
 * modules/lightbox.js — click-to-zoom for screenshots ([data-lightbox] links).
 * Closes on click, Escape or scroll. Without JS the link simply opens the image.
 */
'use strict';
(function initLightbox() {
  document.addEventListener('click', e => {
    const link = e.target.closest && e.target.closest('a[data-lightbox]');
    if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const box = document.createElement('div');
    box.className = 'lightbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Screenshot');
    const img = document.createElement('img');
    img.src = link.getAttribute('href');
    const inner = link.querySelector('img');
    img.alt = inner ? inner.alt : '';
    box.appendChild(img);
    const close = () => {
      box.remove();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close);
      link.focus({ preventScroll: true });
    };
    const onKey = ev => { if (ev.key === 'Escape') close(); };
    box.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, { passive: true, once: true });
    document.body.appendChild(box);
  });
})();
