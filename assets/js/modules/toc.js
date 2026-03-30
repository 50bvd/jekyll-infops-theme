/**
 * modules/toc.js — Table of Contents
 * Auto-generates a TOC from h2/h3/h4 inside .post-body.
 * Fills #toc-content (inline) and #floating-toc-list (floating sidebar).
 * Uses IntersectionObserver to highlight the active heading.
 */
'use strict';
(function initTOC() {
  document.addEventListener('DOMContentLoaded', () => {
    const body     = document.querySelector('.post-body');
    const inline   = document.getElementById('toc-content');
    const floating = document.getElementById('floating-toc-list');
    if (!body || (!inline && !floating)) return;

    const headings = Array.from(body.querySelectorAll('h2, h3, h4'));
    if (!headings.length) return;

    let html = '<ul>', level = 2;
    headings.forEach((h, i) => {
      const lv = parseInt(h.tagName[1], 10);
      if (!h.id) h.id = 'heading-' + i;
      if (lv > level)      html += '<ul>'.repeat(lv - level);
      else if (lv < level) html += '</ul>'.repeat(level - lv);
      html += `<li><a href="#${h.id}">${h.textContent.trim()}</a></li>`;
      level = lv;
    });
    html += '</ul>';

    if (inline)   inline.innerHTML   = html;
    if (floating) floating.innerHTML = html;

    const links = document.querySelectorAll('.toc-content a, #floating-toc-list a');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(l => l.classList.remove('active'));
        links.forEach(l => {
          if (l.getAttribute('href') === '#' + e.target.id) l.classList.add('active');
        });
      });
    }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });

    headings.forEach(h => obs.observe(h));
  });
})();

// Global toggle for floating TOC button (called from HTML onclick)
function toggleFloatingToc() {
  document.querySelector('.floating-toc')?.classList.toggle('open');
}
