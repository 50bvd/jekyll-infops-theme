/**
 * modules/theme-toggle.js — Dark/Light mode toggle
 * Persists the user's explicit choice in localStorage under key 'infops-theme'.
 * Until the user picks one, follows _config.yml default_theme (or the OS when "auto").
 * Dispatches 'themechange' custom event so other modules can react.
 */
'use strict';
(function initThemeToggle() {
  const KEY  = 'infops-theme';
  const root = document.documentElement;
  const mq   = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } }
  };

  function preferred() {
    const saved = store.get();
    if (saved === 'light' || saved === 'dark') return saved;
    const def = root.getAttribute('data-theme-default');
    if (def === 'light' || def === 'dark') return def;
    return mq && mq.matches ? 'light' : 'dark';
  }

  function apply(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (persist) store.set(theme);
    const btn  = document.getElementById('theme-toggle-btn');
    const icon = btn && btn.querySelector('.toggle-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    if (btn)  btn.setAttribute('aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    apply(preferred(), false);
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      // Smooth cross-fade when the browser supports View Transitions
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (document.startViewTransition && !reduced) document.startViewTransition(() => apply(next, true));
      else apply(next, true);
    });
    // Follow OS changes while the user hasn't made an explicit choice
    if (mq && root.getAttribute('data-theme-default') === 'auto') {
      const onChange = () => { if (!store.get()) apply(preferred(), false); };
      mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
    }
  });
})();
