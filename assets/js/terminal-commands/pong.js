/**
 * terminal-commands/pong.js — Pong on the shared game engine (ctx.createGame).
 * 800×500 logical court, speeds in px/second, ball speeds up on every hit,
 * AI with reaction delay + aiming error, first to 7 wins. Mouse, W/S, arrows,
 * finger drag on touch screens.
 */
(function() {
  var W = 800, H = 500, PW = 12, PH = 90, WIN = 7;

  function serve(d, dir) {
    var ang = (Math.random() * 0.6 - 0.3);
    d.speed = 340;
    d.ball = { x: W / 2, y: H / 2 + (Math.random() - 0.5) * 120, vx: Math.cos(ang) * d.speed * dir, vy: Math.sin(ang) * d.speed, r: 8 };
    d.serveDelay = 0.8;
  }

  window.Terminal.register({
    name: 'pong',
    help: ['pong', 'Play Pong  (mouse / W·S / arrows)', 'games'],
    touch: { drag: true },
    run: function(args, ctx) {
      ctx.createGame({
        name: 'pong', title: '🏓 PONG', controls: 'mouse, W/S or arrows · first to ' + WIN,
        width: W, height: H,
        keys: ['ArrowUp', 'ArrowDown', 'w', 'W', 's', 'S', 'z', 'Z'],

        init: function(g) {
          var d = g.data;
          d.p1 = { y: H / 2 - PH / 2, s: 0 };
          d.p2 = { y: H / 2 - PH / 2, s: 0 };
          d.aiTarget = H / 2; d.aiReact = 0; d.mouseY = null;
          serve(d, 1);
        },

        onPointer: function(g, x, y) { g.data.mouseY = y; },

        update: function(g, dt) {
          var d = g.data, k = g.keys, b = d.ball;
          // player
          var up = k.ArrowUp || k.w || k.W || k.z || k.Z, down = k.ArrowDown || k.s || k.S;
          if (up || down) d.mouseY = null;
          if (d.mouseY != null) d.p1.y += (d.mouseY - PH / 2 - d.p1.y) * Math.min(1, dt * 18);
          else d.p1.y += ((down ? 1 : 0) - (up ? 1 : 0)) * 560 * dt;
          d.p1.y = Math.max(0, Math.min(H - PH, d.p1.y));

          // AI: re-aims every ~0.12 s with an error that shrinks as the rally speeds up
          if ((d.aiReact -= dt) <= 0) {
            d.aiReact = 0.12;
            if (b.vx > 0) {
              var t = (W - 30 - b.x) / Math.max(1, b.vx), py = b.y + b.vy * t;
              while (py < 0 || py > H) py = py < 0 ? -py : 2 * H - py;   // bounce prediction
              var err = Math.max(18, 110 - (d.speed - 340) * 0.25);
              d.aiTarget = py + (Math.random() - 0.5) * err;
            } else d.aiTarget = H / 2;
          }
          var aiMax = 300 + (d.speed - 340) * 0.35, c2 = d.p2.y + PH / 2, diff = d.aiTarget - c2;
          if (Math.abs(diff) > 6) d.p2.y += Math.sign(diff) * Math.min(Math.abs(diff), aiMax * dt);
          d.p2.y = Math.max(0, Math.min(H - PH, d.p2.y));

          if (d.serveDelay > 0) { d.serveDelay -= dt; return; }

          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
          if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }

          function hit(padY, dir, x) {
            var rel = (b.y - (padY + PH / 2)) / (PH / 2);          // -1 … 1
            d.speed = Math.min(820, d.speed * 1.05);
            var ang = rel * 1.05;                                  // up to ~60°
            b.vx = Math.cos(ang) * d.speed * dir; b.vy = Math.sin(ang) * d.speed; b.x = x;
          }
          if (b.vx < 0 && b.x - b.r < 30 + PW && b.x > 20 && b.y > d.p1.y - b.r && b.y < d.p1.y + PH + b.r) hit(d.p1.y, 1, 30 + PW + b.r);
          if (b.vx > 0 && b.x + b.r > W - 30 - PW && b.x < W - 20 && b.y > d.p2.y - b.r && b.y < d.p2.y + PH + b.r) hit(d.p2.y, -1, W - 30 - PW - b.r);

          if (b.x < -20) { d.p2.s++; serve(d, -1); }
          if (b.x > W + 20) { d.p1.s++; g.score += 100; serve(d, 1); }
          if (d.p1.s >= WIN) g.end('YOU WIN ' + d.p1.s + '-' + d.p2.s, true);
          else if (d.p2.s >= WIN) g.end('YOU LOSE ' + d.p1.s + '-' + d.p2.s);
        },

        render: function(c, g) {
          var d = g.data, light = g.light(), ac = g.accent();
          c.drawImage(g.layer('court', function(l) {
            l.fillStyle = light ? '#f0f4fc' : '#050a12'; l.fillRect(0, 0, W, H);
            l.strokeStyle = g.color(0.2); l.lineWidth = 2; l.setLineDash([10, 12]);
            l.beginPath(); l.moveTo(W / 2, 0); l.lineTo(W / 2, H); l.stroke(); l.setLineDash([]);
            l.strokeStyle = g.color(0.45); l.strokeRect(1, 1, W - 2, H - 2);
          }, ac.r + ',' + ac.g + ',' + ac.b + light), 0, 0, W, H);

          c.fillStyle = light ? 'rgba(17,24,39,.8)' : 'rgba(230,237,243,.85)';
          c.font = 'bold 56px "JetBrains Mono", monospace'; c.textAlign = 'center';
          c.fillText(d.p1.s, W / 2 - 80, 70); c.fillText(d.p2.s, W / 2 + 80, 70);
          c.textAlign = 'left';

          c.fillStyle = g.color(1);
          c.fillRect(30, d.p1.y, PW, PH);
          c.fillRect(W - 30 - PW, d.p2.y, PW, PH);

          var b = d.ball;
          if (d.serveDelay <= 0 || Math.floor(g.t * 6) % 2 === 0) {
            c.shadowColor = g.color(0.9); c.shadowBlur = 18;
            c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
            c.shadowBlur = 0;
          }
        }
      });
    }
  });
})();
