/**
 * modules/toc.js — Table of Contents
 * Auto-generates a TOC from h2/h3/h4 inside .post-body.
 * Fills #toc-content (inline) and #floating-toc-list (floating sidebar).
 * Uses IntersectionObserver to highlight the active heading.
 * Built with DOM APIs (textContent) — heading text is never parsed as HTML.
 */
'use strict';
(function initTOC() {
  document.addEventListener('DOMContentLoaded', () => {
    // Floating TOC toggle (was an inline onclick)
    const floatWrap = document.querySelector('.floating-toc');
    const floatBtn  = floatWrap && floatWrap.querySelector('.toc-toggle');
    if (floatBtn) {
      floatBtn.addEventListener('click', () => {
        const open = floatWrap.classList.toggle('open');
        floatBtn.setAttribute('aria-expanded', String(open));
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && floatWrap.classList.contains('open')) {
          floatWrap.classList.remove('open');
          floatBtn.setAttribute('aria-expanded', 'false');
          floatBtn.focus();
        }
      });
    }

    const body     = document.querySelector('.post-body');
    const inline   = document.getElementById('toc-content');
    const floating = document.getElementById('floating-toc-list');
    if (!body || (!inline && !floating)) return;

    const headings = Array.from(body.querySelectorAll('h2, h3, h4'));
    const minHeadings = parseInt(document.documentElement.dataset.tocMin || '1', 10);
    if (headings.length < minHeadings) {
      const wrap = inline && inline.closest('.toc-wrapper');
      if (wrap) wrap.hidden = true;
      if (floatWrap) floatWrap.hidden = true;
      return;
    }

    function build() {
      const rootUl = document.createElement('ul');
      const stack  = [{ level: 2, ul: rootUl }];
      headings.forEach((h, i) => {
        const lv = parseInt(h.tagName[1], 10);
        if (!h.id) h.id = 'heading-' + i;
        while (lv > stack[stack.length - 1].level) {
          const parent = stack[stack.length - 1].ul;
          const host = parent.lastElementChild || parent.appendChild(document.createElement('li'));
          const ul = document.createElement('ul');
          host.appendChild(ul);
          stack.push({ level: stack[stack.length - 1].level + 1, ul });
        }
        while (lv < stack[stack.length - 1].level && stack.length > 1) stack.pop();
        const li = document.createElement('li');
        const a  = document.createElement('a');
        a.href = '#' + encodeURIComponent(h.id);
        a.dataset.target = h.id;
        a.textContent = h.textContent.trim();
        li.appendChild(a);
        stack[stack.length - 1].ul.appendChild(li);
      });
      return rootUl;
    }

    if (inline)   inline.replaceChildren(build());
    if (floating) floating.replaceChildren(build());

    const links = Array.from(document.querySelectorAll('.toc-content a, #floating-toc-list a'));
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(l => l.classList.toggle('active', l.dataset.target === e.target.id));
      });
    }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });

    headings.forEach(h => obs.observe(h));
  });
})();

// Kept for backward compatibility with custom layouts using onclick="toggleFloatingToc()"
function toggleFloatingToc() {
  document.querySelector('.floating-toc')?.classList.toggle('open');
}
