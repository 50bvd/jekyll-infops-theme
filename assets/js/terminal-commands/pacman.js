/**
 * terminal-commands/pacman.js — Pac-Man on the shared game engine (ctx.createGame).
 * Smooth tile-to-tile movement (speeds in tiles/second), buffered turns and
 * instant reversal, scatter/chase cycles, frightened mode with ghost chains
 * (200 → 1600), levels that speed up, lives, best score.
 * Walls are drawn once in a cached layer (no per-frame shadowBlur on 150 cells).
 */
(function() {
  // 0 dot · 1 wall · 2 empty · 3 power pellet · 4 door (decor) · 5 ghost house
  var MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,3,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,3,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,1,4,1,0,0,0,1,0,0,0,0,1],
    [1,1,1,1,0,1,0,1,2,1,1,1,2,1,0,1,0,1,1,1,1],
    [2,2,2,2,0,1,0,1,5,5,5,5,5,1,0,1,0,2,2,2,2],
    [1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
    [1,3,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];
  var MR = MAP.length, MC = MAP[0].length, CS = 24, TOP = 30;
  var W = MC * CS, H = MR * CS + TOP;
  var TUNNEL_ROW = 7;
  var PAC_START = { x: 10, y: 9 };
  var GHOSTS = [
    { name: 'blinky', color: '#ff4b4b', x: 12, y: 5, release: 0,   corner: { x: MC - 2, y: 0 } },
    { name: 'pinky',  color: '#ffb4ff', x: 9,  y: 7, release: 2,   corner: { x: 1, y: 0 } },
    { name: 'inky',   color: '#00dcff', x: 10, y: 7, release: 5,   corner: { x: MC - 2, y: MR - 1 } },
    { name: 'clyde',  color: '#ffaf3c', x: 11, y: 7, release: 8,   corner: { x: 1, y: MR - 1 } }
  ];
  var DIRS = {
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], q: [-1, 0], Q: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1], z: [0, -1], Z: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1]
  };

  function wrapX(x) { return x < 0 ? MC - 1 : x >= MC ? 0 : x; }
  function cellAt(board, x, y) {
    if (y === TUNNEL_ROW && (x < 0 || x >= MC)) return 2;
    if (y < 0 || y >= MR || x < 0 || x >= MC) return 1;
    return board[y][x];
  }
  function open(board, x, y, house) {
    var c = cellAt(board, x, y);
    return c !== 1 && c !== 4 && (house || c !== 5);
  }

  window.Terminal.register({
    name: 'pacman',
    help: ['pacman', 'Play Pac-Man  (arrows / WASD)', 'games'],
    run: function(args, ctx) {
      ctx.createGame({
        name: 'pacman', title: '🟡 PAC-MAN', controls: 'arrows / WASD',
        width: W, height: H,
        keys: Object.keys(DIRS),

        init: function(g) {
          var d = g.data;
          d.level = 1; d.lives = 3;
          newLevel(g);
        },

        onKey: function(g, key, down) {
          if (!down || !DIRS[key]) return;
          var p = g.data.pac, nd = DIRS[key];
          p.nd = nd;
          // instant reversal mid-tile
          if ((p.dx || p.dy) && nd[0] === -p.dx && nd[1] === -p.dy) {
            p.x = wrapX(p.x + p.dx); p.y += p.dy; p.dx = nd[0]; p.dy = nd[1]; p.p = 1 - p.p;
          }
        },

        update: function(g, dt) {
          var d = g.data;
          if (d.banner > 0) { d.banner -= dt; return; }
          if (d.dying > 0) {
            d.dying -= dt;
            if (d.dying <= 0) { if (d.lives <= 0) g.end('GAME OVER'); else resetActors(g); }
            return;
          }
          d.clock += dt;
          if (d.fright > 0) d.fright -= dt;
          // scatter 5 s / chase 20 s
          var cycle = d.clock % 25; d.scatter = cycle < 5;

          var pacSpeed = Math.min(9, 7 + (d.level - 1) * 0.4);
          movePac(g, pacSpeed * dt);
          var gs = Math.min(8.5, 6.4 + (d.level - 1) * 0.5);
          d.ghosts.forEach(function(gh) { moveGhost(g, gh, gs, dt); });
          collide(g);
          if (d.left === 0) { d.level++; d.banner = 1.4; newLevel(g, true); }
        },

        render: function(c, g) {
          var d = g.data, light = g.light(), ac = g.accent();
          c.drawImage(g.layer('maze', function(l) {
            l.fillStyle = light ? '#e3e6eb' : '#050a12'; l.fillRect(0, 0, W, H);
            l.save(); l.translate(0, TOP);
            l.shadowColor = g.color(0.55); l.shadowBlur = 8;
            l.fillStyle = g.color(light ? 0.85 : 0.75);
            for (var y = 0; y < MR; y++) for (var x = 0; x < MC; x++) if (MAP[y][x] === 1) l.fillRect(x * CS + 3, y * CS + 3, CS - 6, CS - 6);
            l.shadowBlur = 0;
            l.fillStyle = light ? '#e3e6eb' : '#050a12';   // hollow walls look lighter
            for (var y2 = 0; y2 < MR; y2++) for (var x2 = 0; x2 < MC; x2++) if (MAP[y2][x2] === 1) l.fillRect(x2 * CS + 7, y2 * CS + 7, CS - 14, CS - 14);
            l.fillStyle = '#ffb4ff'; l.fillRect(10 * CS + 3, 5 * CS + CS * 0.42, CS - 6, 4);
            l.restore();
          }, ac.r + ',' + ac.g + ',' + ac.b + light), 0, 0, W, H);

          c.save(); c.translate(0, TOP);
          // dots (plain rects: cheap) + pulsing power pellets
          c.fillStyle = light ? 'rgba(37,99,235,.75)' : 'rgba(255,214,170,.85)';
          for (var y = 0; y < MR; y++) for (var x = 0; x < MC; x++) {
            var v = d.board[y][x];
            if (v === 0) c.fillRect(x * CS + CS / 2 - 2, y * CS + CS / 2 - 2, 4, 4);
          }
          var pr = CS * (0.26 + Math.sin(g.t * 7) * 0.06);
          c.fillStyle = '#ffd24a';
          for (var y3 = 0; y3 < MR; y3++) for (var x3 = 0; x3 < MC; x3++) if (d.board[y3][x3] === 3) {
            c.beginPath(); c.arc(x3 * CS + CS / 2, y3 * CS + CS / 2, pr, 0, Math.PI * 2); c.fill();
          }

          d.ghosts.forEach(function(gh) { drawGhost(c, g, gh); });
          drawPac(c, g);
          c.restore();

          // HUD
          var txt = light ? 'rgba(17,24,39,.88)' : 'rgba(230,237,243,.92)';
          c.font = 'bold 15px "JetBrains Mono", monospace'; c.fillStyle = txt;
          c.fillText('SCORE ' + g.score, 8, 20);
          c.textAlign = 'center'; c.fillText('LEVEL ' + d.level, W / 2, 20);
          c.textAlign = 'right'; c.fillText('BEST ' + Math.max(g.best, g.score), W - 8, 20); c.textAlign = 'left';
          c.fillStyle = '#ffe600';
          for (var i = 0; i < d.lives; i++) {
            c.beginPath(); c.moveTo(150 + i * 20, 15); c.arc(150 + i * 20, 15, 7, 0.6, Math.PI * 2 - 0.6); c.closePath(); c.fill();
          }
          if (d.banner > 0) {
            c.fillStyle = 'rgba(2,6,14,.55)'; c.fillRect(0, H / 2 - 30, W, 60);
            c.fillStyle = g.color(1); c.font = 'bold 30px "JetBrains Mono", monospace'; c.textAlign = 'center';
            c.fillText(d.level === 1 ? 'READY!' : 'LEVEL ' + d.level, W / 2, H / 2 + 10); c.textAlign = 'left';
          }
        }
      });

      // ── game logic ─────────────────────────────────────────────────────────
      function newLevel(g, keepScore) {
        var d = g.data;
        d.board = MAP.map(function(r) { return r.slice(); });
        d.left = 0;
        d.board.forEach(function(r) { r.forEach(function(v) { if (v === 0 || v === 3) d.left++; }); });
        d.clock = 0; d.banner = d.banner || 1.2;
        resetActors(g);
      }

      function resetActors(g) {
        var d = g.data;
        d.pac = { x: PAC_START.x, y: PAC_START.y, dx: -1, dy: 0, p: 0, nd: [-1, 0] };
        d.ghosts = GHOSTS.map(function(def) {
          return { def: def, x: def.x, y: def.y, dx: 0, dy: 0, p: 0,
                   mode: def.release === 0 ? 'out' : 'house', wait: def.release, eaten: false };
        });
        d.fright = 0; d.chain = 0; d.dying = 0;
      }

      function movePac(g, dist) {
        var d = g.data, p = d.pac, b = d.board;
        if (!p.dx && !p.dy) {                       // stopped: start as soon as the buffered way is open
          if (open(b, p.x + p.nd[0], p.y + p.nd[1])) { p.dx = p.nd[0]; p.dy = p.nd[1]; } else return;
        }
        p.p += dist;
        while (p.p >= 1) {
          p.p -= 1;
          p.x = wrapX(p.x + p.dx); p.y += p.dy;
          eat(g, p.x, p.y);
          if (open(b, p.x + p.nd[0], p.y + p.nd[1])) { p.dx = p.nd[0]; p.dy = p.nd[1]; }
          if (!open(b, p.x + p.dx, p.y + p.dy)) { p.dx = 0; p.dy = 0; p.p = 0; break; }
        }
      }

      function eat(g, x, y) {
        var d = g.data, v = d.board[y] && d.board[y][x];
        if (v === 0) { d.board[y][x] = 2; d.left--; g.score += 10; }
        else if (v === 3) {
          d.board[y][x] = 2; d.left--; g.score += 50;
          d.fright = Math.max(2, 6 - (d.level - 1) * 0.5); d.chain = 0;
          d.ghosts.forEach(function(gh) { if (gh.mode === 'out') { gh.dx = -gh.dx; gh.dy = -gh.dy; gh.p = gh.p ? 1 - gh.p : 0; if (gh.p) { gh.x = wrapX(gh.x - gh.dx); gh.y -= gh.dy; } } });
        }
      }

      function target(g, gh) {
        var d = g.data, p = d.pac, def = gh.def;
        if (d.scatter) return def.corner;
        if (def.name === 'blinky') return p;
        if (def.name === 'pinky') return { x: p.x + p.dx * 4, y: p.y + p.dy * 4 };
        if (def.name === 'inky') { var bl = d.ghosts[0]; return { x: 2 * (p.x + p.dx * 2) - bl.x, y: 2 * (p.y + p.dy * 2) - bl.y }; }
        return Math.abs(gh.x - p.x) + Math.abs(gh.y - p.y) > 8 ? p : def.corner;   // clyde
      }

      function moveGhost(g, gh, baseSpeed, dt) {
        var d = g.data, b = d.board;
        if (gh.mode === 'house') {
          if ((gh.wait -= dt) <= 0) { gh.mode = 'exit'; }
          return;
        }
        var scared = d.fright > 0 && gh.mode === 'out' && !gh.eaten;
        var speed = gh.mode === 'exit' ? 4 : scared ? baseSpeed * 0.55 : baseSpeed;
        gh.p += speed * dt;
        if (gh.mode === 'exit' && !gh.dx && !gh.dy) chooseExit(gh);
        while (gh.p >= 1) {
          gh.p -= 1;
          gh.x = wrapX(gh.x + gh.dx); gh.y += gh.dy;
          if (gh.mode === 'exit') {
            if (gh.y === 5) { gh.mode = 'out'; gh.dx = 0; gh.dy = 0; } else chooseExit(gh);
          }
          if (gh.mode === 'out') {
            var opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function(v) {
              return open(b, gh.x + v[0], gh.y + v[1]) && !(v[0] === -gh.dx && v[1] === -gh.dy && (gh.dx || gh.dy));
            });
            if (!opts.length) opts = [[-gh.dx, -gh.dy]];
            var pick;
            if (scared) pick = opts[Math.floor(Math.random() * opts.length)];
            else {
              var t = target(g, gh), best = Infinity;
              opts.forEach(function(v) {
                var dx = gh.x + v[0] - t.x, dy = gh.y + v[1] - t.y, dd = dx * dx + dy * dy;
                if (dd < best) { best = dd; pick = v; }
              });
            }
            gh.dx = pick[0]; gh.dy = pick[1];
          }
        }
      }

      // leave the house through the side openings (columns 8 / 12), then up
      function chooseExit(gh) {
        var col = gh.x <= 10 ? 8 : 12;
        if (gh.y === 7 && gh.x !== col) { gh.dx = gh.x < col ? 1 : -1; gh.dy = 0; }
        else { gh.dx = 0; gh.dy = -1; }
      }

      function pos(e) {
        var x = e.x + e.dx * e.p;
        if (x < -0.5) x += MC; if (x > MC - 0.5) x -= MC;
        return { x: x, y: e.y + e.dy * e.p };
      }

      function collide(g) {
        var d = g.data, pp = pos(d.pac);
        d.ghosts.forEach(function(gh) {
          if (gh.mode !== 'out') return;
          var gp = pos(gh), dx = gp.x - pp.x, dy = gp.y - pp.y;
          if (dx * dx + dy * dy > 0.45) return;
          if (d.fright > 0 && !gh.eaten) {
            d.chain++; g.score += 100 * Math.pow(2, d.chain);
            gh.x = gh.def.x; gh.y = 7; gh.dx = 0; gh.dy = 0; gh.p = 0; gh.mode = 'house'; gh.wait = 3; gh.eaten = false;
          } else if (d.dying <= 0) {
            d.lives--; d.dying = 1.2;
          }
        });
      }

      function drawPac(c, g) {
        var d = g.data, p = pos(d.pac), cx = p.x * CS + CS / 2, cy = p.y * CS + CS / 2;
        var mouth = d.dying > 0 ? Math.min(Math.PI, (1.2 - d.dying) * 3) : 0.08 + Math.abs(Math.sin(g.t * 14)) * 0.45;
        var ang = Math.atan2(d.pac.dy, d.pac.dx || (d.pac.dy ? 0 : -1));
        c.fillStyle = '#ffe600';
        c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, CS * 0.44, ang + mouth, ang + Math.PI * 2 - mouth); c.closePath(); c.fill();
      }

      function drawGhost(c, g, gh) {
        var d = g.data, p = pos(gh);
        var bob = gh.mode === 'house' ? Math.sin(g.t * 6 + gh.def.x) * 3 : 0;
        var cx = p.x * CS + CS / 2, cy = p.y * CS + CS / 2 + bob, r = CS * 0.44;
        var scared = d.fright > 0 && gh.mode === 'out';
        var color = scared ? (d.fright < 1.5 && Math.floor(g.t * 8) % 2 ? '#ffffff' : '#2b5cff') : gh.def.color;
        c.fillStyle = color;
        c.beginPath();
        c.arc(cx, cy - 2, r, Math.PI, 0);
        c.lineTo(cx + r, cy + r - 2);
        var w = (2 * r) / 4;
        for (var i = 0; i < 4; i++) {
          var x0 = cx + r - i * w;
          c.lineTo(x0 - w / 2, cy + r - 6 + (Math.floor(g.t * 8) % 2 ? 2 : 0));
          c.lineTo(x0 - w, cy + r - 2);
        }
        c.closePath(); c.fill();
        if (!scared) {
          c.fillStyle = '#fff';
          c.beginPath(); c.arc(cx - 4.5, cy - 4, 3.6, 0, Math.PI * 2); c.arc(cx + 4.5, cy - 4, 3.6, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#1a3dff';
          c.beginPath(); c.arc(cx - 4.5 + gh.dx * 1.6, cy - 4 + gh.dy * 1.6, 1.8, 0, Math.PI * 2); c.arc(cx + 4.5 + gh.dx * 1.6, cy - 4 + gh.dy * 1.6, 1.8, 0, Math.PI * 2); c.fill();
        } else {
          c.fillStyle = '#ffd6d6';
          c.fillRect(cx - 5, cy - 5, 3, 3); c.fillRect(cx + 2, cy - 5, 3, 3);
        }
      }
    }
  });
})();
