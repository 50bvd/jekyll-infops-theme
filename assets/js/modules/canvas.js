/**
 * modules/canvas.js — Particle canvas background
 * Reads params from data-attributes on #bg-canvas (set in default.html).
 * Dispatches 'themechange' event to update colors on theme switch.
 */
'use strict';
(function initCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, animFrame;
  let mouseX = -9999, mouseY = -9999;

  const PARTICLE_COUNT = parseInt(canvas.dataset.particles  || '80',  10);
  const MAX_DIST       = parseInt(canvas.dataset.maxDist    || '130', 10);
  const CURSOR_DIST    = parseInt(canvas.dataset.cursorDist || '160', 10);
  const CURSOR_PUSH    = 80;

  function getCSSVar(n) {
    return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  }

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
      const d  = Math.hypot(dx, dy);
      if (d < CURSOR_PUSH && d > 0) {
        const f = (CURSOR_PUSH - d) / CURSOR_PUSH;
        this.x += (dx / d) * f * 2;
        this.y += (dy / d) * f * 2;
      }
      this.x += this.vx;
      this.y += this.vy;
      if (this.y > H + 10 || this.x < -10 || this.x > W + 10) this.reset(false);
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle   = pColor;
      ctx.globalAlpha = this.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  let particles = [];
  let pColor = 'rgba(88,166,255,0.35)';
  let lColor = 'rgba(88,166,255,0.12)';

  function updateColors() {
    pColor = getCSSVar('--canvas-particle') || 'rgba(88,166,255,0.35)';
    lColor = getCSSVar('--canvas-line')     || 'rgba(88,166,255,0.12)';
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const d = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
        if (d < MAX_DIST) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle  = lColor;
          ctx.globalAlpha  = (1 - d / MAX_DIST) * 0.6;
          ctx.lineWidth    = 0.8;
          ctx.stroke();
          ctx.globalAlpha  = 1;
        }
      }
      const d = Math.hypot(particles[i].x - mouseX, particles[i].y - mouseY);
      if (d < CURSOR_DIST) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(mouseX, mouseY);
        ctx.strokeStyle  = lColor;
        ctx.globalAlpha  = (1 - d / CURSOR_DIST) * 0.8;
        ctx.lineWidth    = 1.2;
        ctx.stroke();
        ctx.globalAlpha  = 1;
      }
    }
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    drawLines();
    animFrame = requestAnimationFrame(loop);
  }

  function init() {
    resize();
    updateColors();
    particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle());
    if (animFrame) cancelAnimationFrame(animFrame);
    loop();
  }

  window.addEventListener('resize',      () => resize());
  window.addEventListener('mousemove',   e  => { mouseX = e.clientX; mouseY = e.clientY; });
  window.addEventListener('mouseleave',  () => { mouseX = -9999; mouseY = -9999; });
  window.addEventListener('themechange', () => updateColors());
  document.addEventListener('DOMContentLoaded', init);
})();
