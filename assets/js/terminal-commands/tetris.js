/**
 * terminal-commands/tetris.js — Tetris on the shared game engine (ctx.createGame).
 * 10×20 board, 7-bag randomizer, rotation with wall kicks, hold (C), ghost piece,
 * lock delay, gravity by level, soft/hard drop scoring, line-clear flash.
 * Cells are plain fills (no per-cell shadowBlur): cheap to draw at any size.
 */
(function() {
  var COLS = 10, ROWS = 20, CS = 24, BX = 20, BY = 20, HX = BX + COLS * CS + 24;
  var W = HX + 150, H = BY * 2 + ROWS * CS;
  var SHAPES = [
    [[0,1],[1,1],[2,1],[3,1]],   // I
    [[0,0],[1,0],[0,1],[1,1]],   // O
    [[1,0],[0,1],[1,1],[2,1]],   // T
    [[1,0],[2,0],[0,1],[1,1]],   // S
    [[0,0],[1,0],[1,1],[2,1]],   // Z
    [[0,0],[0,1],[1,1],[2,1]],   // J
    [[2,0],[0,1],[1,1],[2,1]]    // L
  ];
  var COLORS = ['#39c5cf', '#e3b341', '#a371f7', '#56d364', '#f85149', '#58a6ff', '#ffa657'];
  var KICKS = [0, -1, 1, -2, 2];

  function rotate(cells, o) {
    if (o === 1) return cells.map(function(c) { return c.slice(); });   // O doesn't rotate
    var cx = 0, cy = 0;
    cells.forEach(function(c) { cx += c[0]; cy += c[1]; });
    cx = Math.round(cx / cells.length); cy = Math.round(cy / cells.length);
    return cells.map(function(c) { return [cx - (c[1] - cy), cy + (c[0] - cx)]; });
  }

  function cell(c, x, y, color, alpha) {
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = color; c.fillRect(x + 1, y + 1, CS - 2, CS - 2);
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x + 2, y + 2, CS - 4, 5);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + 2, y + CS - 5, CS - 4, 3);
    c.globalAlpha = 1;
  }

  window.Terminal.register({
    name: 'tetris',
    help: ['tetris', 'Play Tetris  (arrows · space · C hold)', 'games'],
    touch: { tap: 'ArrowUp' },
    run: function(args, ctx) {
      ctx.createGame({
        name: 'tetris', title: '🧱 TETRIS', controls: '← → move · ↑ rotate · ↓ soft · Space drop · C hold',
        width: W, height: H,
        keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'c', 'C', 'x', 'X', 'Shift'],

        init: function(g) {
          var d = g.data;
          d.board = []; for (var r = 0; r < ROWS; r++) d.board.push(new Array(COLS).fill(-1));
          d.bag = []; d.lines = 0; d.level = 1; d.fall = 0; d.lock = 0; d.hold = -1; d.canHold = true;
          d.flash = []; d.flashT = 0;
          d.next = draw(d); spawn(g);
        },

        onKey: function(g, key, down) {
          var d = g.data, p = d.cur;
          if (!down || d.flashT > 0) return;          // piece already locked, lines flashing
          if (key === 'ArrowLeft')  move(g, -1, 0);
          if (key === 'ArrowRight') move(g, 1, 0);
          if (key === 'ArrowDown')  { if (move(g, 0, 1)) { g.score += 1; d.fall = 0; } }
          if (key === 'ArrowUp' || key === 'x' || key === 'X') {
            var rc = rotate(p.cells, p.t);
            for (var i = 0; i < KICKS.length; i++) {
              if (fits(d, rc, p.x + KICKS[i], p.y)) { p.cells = rc; p.x += KICKS[i]; d.lock = 0; break; }
            }
          }
          if (key === ' ') { var n = 0; while (move(g, 0, 1)) n++; g.score += n * 2; lockPiece(g); }
          if ((key === 'c' || key === 'C' || key === 'Shift') && d.canHold) {
            var t = p.t;
            if (d.hold < 0) { d.hold = t; spawn(g); } else { var h = d.hold; d.hold = t; spawn(g, h); }
            d.canHold = false;
          }
        },

        update: function(g, dt) {
          var d = g.data;
          if (d.flashT > 0) { d.flashT -= dt; if (d.flashT <= 0) collapse(g); return; }
          var interval = Math.max(0.05, 0.8 - (d.level - 1) * 0.07);
          d.fall += dt;
          if (d.fall >= interval) {
            d.fall = 0;
            if (!move(g, 0, 1)) { d.lock += interval; }
          }
          if (!fits(d, d.cur.cells, d.cur.x, d.cur.y + 1)) {
            d.lock += dt;
            if (d.lock >= 0.5) lockPiece(g);
          } else d.lock = 0;
        },

        render: function(c, g) {
          var d = g.data, light = g.light(), ac = g.accent();
          var txt = light ? 'rgba(17,24,39,.88)' : 'rgba(230,237,243,.92)', dim = g.color(0.7);
          c.drawImage(g.layer('frame', function(l) {
            l.fillStyle = light ? '#e3e6eb' : '#050a12'; l.fillRect(0, 0, W, H);
            l.fillStyle = light ? '#dadee5' : '#070e1a'; l.fillRect(BX, BY, COLS * CS, ROWS * CS);
            l.strokeStyle = g.color(0.08); l.lineWidth = 1;
            for (var x = 1; x < COLS; x++) { l.beginPath(); l.moveTo(BX + x * CS + .5, BY); l.lineTo(BX + x * CS + .5, BY + ROWS * CS); l.stroke(); }
            for (var y = 1; y < ROWS; y++) { l.beginPath(); l.moveTo(BX, BY + y * CS + .5); l.lineTo(BX + COLS * CS, BY + y * CS + .5); l.stroke(); }
            l.strokeStyle = g.color(0.55); l.lineWidth = 2; l.strokeRect(BX - 1, BY - 1, COLS * CS + 2, ROWS * CS + 2);
          }, ac.r + ',' + ac.g + ',' + ac.b + light), 0, 0, W, H);

          for (var r = 0; r < ROWS; r++) for (var cl = 0; cl < COLS; cl++) {
            var v = d.board[r][cl];
            if (v >= 0) cell(c, BX + cl * CS, BY + r * CS, d.flash.indexOf(r) >= 0 && Math.floor(g.t * 20) % 2 ? '#ffffff' : COLORS[v]);
          }
          if (d.flashT <= 0) {
            var p = d.cur, gy = p.y;
            while (fits(d, p.cells, p.x, gy + 1)) gy++;
            p.cells.forEach(function(k) { if (gy + k[1] >= 0) cell(c, BX + (p.x + k[0]) * CS, BY + (gy + k[1]) * CS, COLORS[p.t], 0.22); });
            p.cells.forEach(function(k) { if (p.y + k[1] >= 0) cell(c, BX + (p.x + k[0]) * CS, BY + (p.y + k[1]) * CS, COLORS[p.t]); });
          }

          // HUD
          function label(t, y) { c.font = '13px "JetBrains Mono", monospace'; c.fillStyle = dim; c.fillText(t, HX, y); }
          function value(t, y, s) { c.font = 'bold ' + (s || 22) + 'px "JetBrains Mono", monospace'; c.fillStyle = txt; c.fillText(t, HX, y); }
          label('SCORE', 40); value(g.score, 66);
          label('BEST', 100); value(Math.max(g.best, g.score), 124, 18);
          label('LINES', 158); value(d.lines, 182, 18);
          label('LEVEL', 216); value(d.level, 242, 24);
          label('NEXT', 282); mini(c, d.next, HX, 294);
          label('HOLD  (C)', 372); if (d.hold >= 0) mini(c, d.hold, HX, 384, !d.canHold);
          c.font = '11px "JetBrains Mono", monospace'; c.fillStyle = dim;
          c.fillText('P pause · Esc quit', HX, H - 22);
        }
      });

      // ── helpers (closures over the engine's g.data) ──
      function draw(d) {
        if (!d.bag.length) { d.bag = [0, 1, 2, 3, 4, 5, 6]; for (var i = 6; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = d.bag[i]; d.bag[i] = d.bag[j]; d.bag[j] = t; } }
        return d.bag.pop();
      }
      function spawn(g, type) {
        var d = g.data, t = type == null ? d.next : type;
        if (type == null) d.next = draw(d);
        d.cur = { t: t, cells: SHAPES[t].map(function(c) { return c.slice(); }), x: 3, y: t === 0 ? -1 : 0 };
        d.lock = 0; d.fall = 0;
        if (!fits(d, d.cur.cells, d.cur.x, d.cur.y)) g.end('GAME OVER');
      }
      function fits(d, cells, px, py) {
        return cells.every(function(c) {
          var x = c[0] + px, y = c[1] + py;
          return x >= 0 && x < COLS && y < ROWS && (y < 0 || d.board[y][x] < 0);
        });
      }
      function move(g, dx, dy) {
        var p = g.data.cur;
        if (!fits(g.data, p.cells, p.x + dx, p.y + dy)) return false;
        p.x += dx; p.y += dy;
        if (dx) g.data.lock = 0;
        return true;
      }
      function lockPiece(g) {
        var d = g.data, p = d.cur;
        p.cells.forEach(function(c) { var y = c[1] + p.y; if (y >= 0) d.board[y][c[0] + p.x] = p.t; });
        d.flash = [];
        for (var r = 0; r < ROWS; r++) if (d.board[r].every(function(v) { return v >= 0; })) d.flash.push(r);
        d.canHold = true;
        if (d.flash.length) { d.flashT = 0.25; return; }
        spawn(g);
      }
      function collapse(g) {
        var d = g.data, n = d.flash.length;
        d.flash.sort(function(a, b) { return b - a; }).forEach(function(r) { d.board.splice(r, 1); });
        for (var i = 0; i < n; i++) d.board.unshift(new Array(COLS).fill(-1));
        d.flash = [];
        d.lines += n;
        g.score += [0, 100, 300, 500, 800][n] * d.level;
        d.level = Math.floor(d.lines / 10) + 1;
        spawn(g);
      }
      function mini(c, t, x, y, faded) {
        var s = 16;
        SHAPES[t].forEach(function(k) {
          c.globalAlpha = faded ? 0.35 : 1;
          c.fillStyle = COLORS[t]; c.fillRect(x + k[0] * s, y + k[1] * s, s - 2, s - 2);
        });
        c.globalAlpha = 1;
      }
    }
  });
})();
