/**
 * theme-init.js — runs synchronously in <head>, before first paint:
 * applies the saved/default theme (no flash) and prepares the scroll reveal.
 * External file (not inline) so it keeps working under a strict CSP.
 */
(function(){
  var d = document.documentElement, t = null;
  try { t = localStorage.getItem('infops-theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    var def = d.getAttribute('data-theme-default');
    t = (def === 'light' || def === 'dark') ? def
      : (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }
  d.setAttribute('data-theme', t);
  d.classList.add('js');
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still && 'IntersectionObserver' in window) {
    d.classList.add('reveal-ready');
    /* Fail-safe: never leave content hidden if scroll-fx.js does not load */
    setTimeout(function(){ if (!window.InfOpsReveal) d.classList.remove('reveal-ready'); }, 2500);
  }
})();
