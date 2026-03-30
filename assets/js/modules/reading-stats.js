/**
 * modules/reading-stats.js — Reading time & word count
 * Reads .post-body text, calculates time at 200 wpm,
 * fills #reading-time and #word-count spans in the post header.
 */
'use strict';
(function initReadingStats() {
  document.addEventListener('DOMContentLoaded', () => {
    const body = document.querySelector('.post-body');
    if (!body) return;
    const words = (body.textContent || '').trim().split(/\s+/).filter(Boolean).length;
    const time  = Math.max(1, Math.ceil(words / 200));
    const rt = document.getElementById('reading-time');
    const wc = document.getElementById('word-count');
    if (rt) rt.textContent = time + ' min read';
    if (wc) wc.textContent = words.toLocaleString() + ' words';
  });
})();
