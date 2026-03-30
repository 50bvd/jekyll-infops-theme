/**
 * modules/theme-toggle.js — Dark/Light mode toggle
 * Persists choice in localStorage under key 'infops-theme'.
 * Dispatches 'themechange' custom event so other modules can react.
 */
'use strict';
(function initThemeToggle() {
  const KEY = 'infops-theme';

  function preferred() {
    return localStorage.getItem(KEY)
      || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    const btn  = document.getElementById('theme-toggle-btn');
    const icon = btn && btn.querySelector('.toggle-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (btn)  btn.setAttribute('aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    apply(preferred());
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.addEventListener('click', () =>
      apply(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  });
})();
