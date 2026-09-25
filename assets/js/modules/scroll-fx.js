/**
 * modules/scroll-fx.js — Smooth scroll-driven effects
 *
 *   · header  : .is-scrolled once the page leaves the top
 *   · hero    : parallax / fade driven by the --hero-p CSS variable (0 → 1)
 *   · reveal  : .reveal / .fade-in elements animate in when entering the viewport
 *               (staggered per batch, also for nodes added later, e.g. search results)
 *   · back-to-top button with a reading-progress ring
 *
 * One passive scroll listener, work batched in requestAnimationFrame, only
 * transform/opacity are animated (compositor-friendly, no layout thrashing).
 * Honors prefers-reduced-motion.
 */
'use strict';
(function initScrollFx() {
  var root    = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var header  = document.querySelector('.main-header');
  var hero    = document.getElementById('hero');
  var toTop   = document.getElementById('back-to-top');
  var ring    = toTop && toTop.querySelector('circle');
  var RING_LEN = 0;

  if (ring) {
    RING_LEN = 2 * Math.PI * parseFloat(ring.getAttribute('r'));
    ring.style.strokeDasharray  = RING_LEN;
    ring.style.strokeDashoffset = RING_LEN;
  }

  // ── Scroll loop (rAF-throttled) ─────────────────────────────────────────────
  var ticking = false, heroH = hero ? hero.offsetHeight : 0, lastP = -1;

  function update() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;

    if (header) header.classList.toggle('is-scrolled', y > 12);

    if (hero && !reduced && heroH) {
      var p = Math.min(1, Math.max(0, y / (heroH * 0.85)));
      p = Math.round(p * 1000) / 1000;
      if (p !== lastP) {
        hero.style.setProperty('--hero-p', p);
        hero.classList.toggle('is-parallax', p > 0 && p < 1);
        lastP = p;
      }
    }

    if (toTop) {
      var max = root.scrollHeight - window.innerHeight;
      toTop.classList.toggle('is-visible', y > Math.max(400, window.innerHeight * 0.6));
      if (ring && max > 0) ring.style.strokeDashoffset = RING_LEN * (1 - Math.min(1, y / max));
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function() {
    heroH = hero ? hero.offsetHeight : 0;
    onScroll();
  }, { passive: true });
  update();

  if (toTop) toTop.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    var skip = document.getElementById('main-content');
    if (skip) { skip.setAttribute('tabindex', '-1'); skip.focus({ preventScroll: true }); }
  });

  // ── Reveal on scroll ──────────────────────────────────────────────────────
  var SELECTOR = '.reveal, .fade-in';
  if (reduced || !('IntersectionObserver' in window)) {
    root.classList.remove('reveal-ready');
    window.InfOpsReveal = function() {};
    return;
  }

  function done(el) {
    // Drop the reveal transition once played so hover transitions take over
    var delay = parseFloat(el.style.getPropertyValue('--reveal-delay')) || 0;
    setTimeout(function() { el.classList.add('reveal-done'); }, 850 + delay * 1000);
  }

  var io = new IntersectionObserver(function(entries) {
    var batch = entries.filter(function(e) { return e.isIntersecting; })
                       .map(function(e) { return e.target; });
    batch.forEach(function(el, i) {
      el.style.setProperty('--reveal-delay', Math.min(i, 6) * 0.07 + 's');
      el.classList.add('is-visible');
      io.unobserve(el);
      done(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  function observe(scope) {
    (scope || document).querySelectorAll(SELECTOR).forEach(function(el) {
      if (!el.classList.contains('is-visible')) io.observe(el);
    });
  }

  // Exposed so dynamic content (search results…) can opt in explicitly
  window.InfOpsReveal = observe;

  root.classList.add('reveal-ready');   // usually already set by the <head> script (no flash)
  observe(document);

  // Safety net for nodes injected by other scripts
  if ('MutationObserver' in window) {
    var main = document.getElementById('main-content') || document.body;
    new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1 || n.closest('#hero-terminal')) continue;
          if (n.matches(SELECTOR)) io.observe(n);
          else if (n.firstElementChild) observe(n);
        }
      }
    }).observe(main, { childList: true, subtree: true });
  }
})();
