/**
 * modules/canvas.js — Particle canvas background
 * Reads params from data-attributes on #bg-canvas (set in default.html).
 * Listens to 'themechange' to update colors on theme switch.
 *
 * Performance: HiDPI-aware, fewer particles on small screens, squared-distance
 * checks, links and dots batched into a few paths (a handful of draw calls per
 * frame instead of thousands), paused when the tab is hidden, and a
 * single static frame when the user prefers reduced motion.
 */
'use strict';
(function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, DPR = 1, animFrame = null, running = false;
  let mouseX = -9999, mouseY = -9999;

  const BASE_COUNT  = parseInt(canvas.dataset.particles  || '80',  10);
  const MAX_DIST    = parseInt(canvas.dataset.maxDist    || '130', 10);
  const CURSOR_DIST = parseInt(canvas.dataset.cursorDist || '160', 10);
  const MAX_DIST2    = MAX_DIST * MAX_DIST;
  const CURSOR_DIST2 = CURSOR_DIST * CURSOR_DIST;
  const CURSOR_PUSH  = 80;

  function getCSSVar(n) {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  }

  let pColor = 'rgba(88,166,255,0.35)';
  let lColor = 'rgba(88,166,255,0.12)';

  class Particle {
    constructor() { this.reset(true); }
    reset(init) {
      this.x     = Math.random() * W;
      this.y     = init ? Math.random() * H : -10;
      this.vx    = (Math.random() - 0.5) * 0.4;
      this.vy    = Math.random() * 0.3 + 0.1;
      this.r     = Math.random() * 2 + 1;
      this.alpha = Math.random() * 0.5 + 0.2;
    }
    update() {
      const dx = this.x - mouseX, dy = this.y - mouseY;
      const d2 = dx * dx + dy * dy;
      if (d2 < CURSOR_PUSH * CURSOR_PUSH && d2 > 0) {
        const d = Math.sqrt(d2);
        const f = (CURSOR_PUSH - d) / CURSOR_PUSH;
        this.x += (dx / d) * f * 2;
        this.y += (dy / d) * f * 2;
      }
      this.x += this.vx;
      this.y += this.vy;
      if (this.y > H + 10 || this.x < -10 || this.x > W + 10) this.reset(false);
    }
  }

  let particles = [];

  function updateColors() {
    pColor = getCSSVar('--canvas-particle') || 'rgba(88,166,255,0.35)';
    lColor = getCSSVar('--canvas-line')     || 'rgba(88,166,255,0.12)';
    if (!running) frame(false);
  }

  function particleCount() {
    // Scale down on small screens (≈ 1 particle per 14k px², capped by config)
    const byArea = Math.round((W * H) / 14000);
    return Math.max(18, Math.min(BASE_COUNT, byArea));
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const n = particleCount();
    if (particles.length > n) particles.length = n;
    while (particles.length < n) particles.push(new Particle());
    particles.forEach(p => { if (p.x > W || p.y > H) p.reset(true); });
    if (!running) frame(false);
  }

  // Links are grouped into a few opacity buckets and drawn with one stroke()
  // per bucket (instead of one per link: up to ~3 000 draw calls a frame).
  const BUCKETS = 6;
  function drawLines() {
    const n = particles.length;
    const links = [], cursor = [];
    for (let k = 0; k < BUCKETS; k++) { links.push(new Path2D()); cursor.push(new Path2D()); }
    for (let i = 0; i < n; i++) {
      const a = particles[i];
      for (let j = i + 1; j < n; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MAX_DIST2) {
          const k = Math.min(BUCKETS - 1, Math.floor((1 - Math.sqrt(d2) / MAX_DIST) * BUCKETS));
          links[k].moveTo(a.x, a.y);
          links[k].lineTo(b.x, b.y);
        }
      }
      const cx = a.x - mouseX, cy = a.y - mouseY;
      const c2 = cx * cx + cy * cy;
      if (c2 < CURSOR_DIST2) {
        const k = Math.min(BUCKETS - 1, Math.floor((1 - Math.sqrt(c2) / CURSOR_DIST) * BUCKETS));
        cursor[k].moveTo(a.x, a.y);
        cursor[k].lineTo(mouseX, mouseY);
      }
    }
    ctx.strokeStyle = lColor;
    for (let k = 0; k < BUCKETS; k++) {
      const strength = (k + 0.5) / BUCKETS;
      ctx.lineWidth = 0.8; ctx.globalAlpha = strength * 0.6; ctx.stroke(links[k]);
      ctx.lineWidth = 1.2; ctx.globalAlpha = strength * 0.8; ctx.stroke(cursor[k]);
    }
    ctx.globalAlpha = 1;
  }

  function frame(step) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = pColor;
    const dots = [];
    for (let k = 0; k < BUCKETS; k++) dots.push(new Path2D());
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (step) p.update();
      const path = dots[Math.min(BUCKETS - 1, Math.floor((p.alpha - 0.2) / 0.5 * BUCKETS))];
      path.moveTo(p.x + p.r, p.y);
      path.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    for (let k = 0; k < BUCKETS; k++) { ctx.globalAlpha = 0.2 + (k + 0.5) / BUCKETS * 0.5; ctx.fill(dots[k]); }
    ctx.globalAlpha = 1;
    drawLines();
  }

  function loop() {
    frame(true);
    animFrame = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduced || document.hidden) return;
    running = true;
    animFrame = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = null;
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }, { passive: true });
  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { mouseX = e.clientX; mouseY = e.clientY; }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouseX = -9999; mouseY = -9999; });
  window.addEventListener('blur', () => { mouseX = -9999; mouseY = -9999; });
  window.addEventListener('themechange', updateColors);
  document.addEventListener('visibilitychange', () => { document.hidden ? stop() : start(); });

  function init() {
    updateColors();
    resize();
    start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
