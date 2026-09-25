/**
 * terminal-commands/2048.js — 2048 on the shared game engine (ctx.createGame).
 * Arrows / WASD / swipe. Tiles slide and pop (100 ms animations), reaching
 * 2048 wins but you can keep playing (C), best score saved by the engine.
 */
(function() {
  var N = 4, CS = 104, GAP = 12, BX = 20, BY = 84;
  var BOARD = N * CS + (N + 1) * GAP, W = BOARD + BX * 2, H = BY + BOARD + 20;
  var SLIDE = 0.1, POP = 0.12;
  var DIRS = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1], z: [0, -1], Z: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], q: [-1, 0], Q: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
  };
  var TILE = {
    2: '#2a3a52', 4: '#31476a', 8: '#e3874a', 16: '#ec6d3f', 32: '#f0553b', 64: '#f23b2b',
    128: '#e8c547', 256: '#e9c02f', 512: '#eab81a', 1024: '#6fcf6a', 2048: '#39c5cf'
  };
  var TILE_LIGHT = { 2: '#eceef2', 4: '#dfe3ea' };

  function pos(i) { return GAP + i * (CS + GAP); }
  function ease(t) { return 1 - Math.pow(1 - Math.min(1, t), 3); }

  window.Terminal.register({
    name: '2048',
    help: ['2048', 'Slide & merge tiles  (arrows / swipe)', 'games'],
    run: function(args, ctx) {
      var nextId = 1;

      function empty(d) {
        var out = [];
        for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!d.grid[y][x]) out.push([x, y]);
        return out;
      }
      function addTile(d) {
        var e = empty(d);
        if (!e.length) return;
        var p = e[Math.floor(Math.random() * e.length)];
        d.grid[p[1]][p[0]] = { id: nextId++, v: Math.random() < 0.9 ? 2 : 4, x: p[0], y: p[1], fx: p[0], fy: p[1], born: 0 };
      }
      function canMove(d) {
        if (empty(d).length) return true;
        for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
          var v = d.grid[y][x].v;
          if ((x < N - 1 && d.grid[y][x + 1].v === v) || (y < N - 1 && d.grid[y + 1][x].v === v)) return true;
        }
        return false;
      }

      function slide(g, dir) {
        var d = g.data, dx = dir[0], dy = dir[1], moved = false;
        d.ghosts = [];
        var grid = [];
        for (var y = 0; y < N; y++) { grid.push([]); for (var x = 0; x < N; x++) {
          var t = d.grid[y][x];
          if (t) { t.fx = t.x; t.fy = t.y; t.merged = false; t.born = 1; }
          grid[y].push(null);
        } }
        // walk each line from the side we move towards
        for (var line = 0; line < N; line++) {
          var cells = [];
          for (var k = 0; k < N; k++) {
            var i = (dx > 0 || dy > 0) ? N - 1 - k : k;
            cells.push(dx !== 0 ? [i, line] : [line, i]);
          }
          var target = 0, lastTile = null;
          cells.forEach(function(c) {
            var t = d.grid[c[1]][c[0]];
            if (!t) return;
            if (lastTile && lastTile.v === t.v && !lastTile.merged) {
              // t slides onto lastTile, lastTile doubles once the slide is over
              t.x = lastTile.x; t.y = lastTile.y;
              d.ghosts.push(t);
              lastTile.merged = true; lastTile.v *= 2; lastTile.pop = 0;
              g.score += lastTile.v;
              if (lastTile.v === 2048 && !d.won2048) d.reached = true;
              moved = true;
              return;
            }
            var dest = cells[target++];
            if (dest[0] !== t.x || dest[1] !== t.y) moved = true;
            t.x = dest[0]; t.y = dest[1];
            grid[t.y][t.x] = t;
            lastTile = t;
          });
        }
        if (!moved) return;
        d.grid = grid;
        d.anim = 0;
        addTile(d);
        d.moves++;
      }

      ctx.createGame({
        name: '2048', title: '🔢 2048', controls: 'arrows / WASD / swipe · C continue after 2048',
        width: W, height: H,
        keys: Object.keys(DIRS).concat(['c', 'C']),

        init: function(g) {
          var d = g.data;
          d.grid = []; for (var y = 0; y < N; y++) d.grid.push([null, null, null, null]);
          d.ghosts = []; d.anim = 1; d.moves = 0; d.won2048 = false; d.reached = false; d.banner = 0;
          addTile(d); addTile(d);
        },

        onKey: function(g, key, down) {
          var d = g.data;
          if (!down) return;
          if ((key === 'c' || key === 'C') && d.banner > 0) { d.banner = 0; return; }
          if (!DIRS[key] || d.banner > 0) return;
          if (d.anim < 1) { d.anim = 1; d.ghosts = []; }       // finish the previous slide instantly
          slide(g, DIRS[key]);
        },

        update: function(g, dt) {
          var d = g.data;
          if (d.anim < 1) { d.anim = Math.min(1, d.anim + dt / SLIDE); if (d.anim >= 1) d.ghosts = []; }
          for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
            var t = d.grid[y][x];
            if (!t) continue;
            if (t.born < 1 && d.anim >= 1) t.born = Math.min(1, t.born + dt / POP);
            if (t.pop != null && d.anim >= 1) { t.pop += dt / POP; if (t.pop >= 1) t.pop = null; }
          }
          if (d.reached) { d.reached = false; d.won2048 = true; d.banner = 1; }
          if (d.anim >= 1 && !canMove(d)) g.end('NO MORE MOVES');
        },

        render: function(c, g) {
          var d = g.data, light = g.light(), ac = g.accent();
          c.drawImage(g.layer('board', function(l) {
            l.fillStyle = light ? '#e3e6eb' : '#050a12'; l.fillRect(0, 0, W, H);
            l.fillStyle = light ? '#c9d3e3' : '#0c1624';
            round(l, BX, BY, BOARD, BOARD, 12); l.fill();
            l.fillStyle = light ? '#dbe2ee' : '#132034';
            for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { round(l, BX + pos(x), BY + pos(y), CS, CS, 8); l.fill(); }
            l.strokeStyle = g.color(0.45); l.lineWidth = 2; round(l, BX - 1, BY - 1, BOARD + 2, BOARD + 2, 13); l.stroke();
          }, ac.r + ',' + ac.g + ',' + ac.b + light), 0, 0, W, H);

          // HUD
          var txt = light ? 'rgba(17,24,39,.88)' : 'rgba(230,237,243,.92)';
          c.fillStyle = g.color(1); c.font = 'bold 40px "JetBrains Mono", monospace';
          c.fillText('2048', BX, 56);
          box(c, g, W - BX - 230, 'SCORE', g.score, txt);
          box(c, g, W - BX - 110, 'BEST', Math.max(g.best, g.score), txt);

          var k = ease(d.anim);
          d.ghosts.forEach(function(t) { tile(c, t, k, light, 1); });
          for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
            var t = d.grid[y][x];
            if (!t) continue;
            var s = 1;
            if (d.anim >= 1 && t.born < 1) s = ease(t.born);
            else if (d.anim < 1 && t.born < 1) continue;     // new tile appears after the slide
            if (d.anim >= 1 && t.pop != null) s = 1 + Math.sin(t.pop * Math.PI) * 0.12;
            // merged tile keeps its old value on screen until the slide ends
            tile(c, t, k, light, s, d.anim < 1 && t.merged ? t.v / 2 : t.v);
          }

          if (d.banner > 0) {
            c.fillStyle = 'rgba(2,6,14,.6)'; c.fillRect(BX, BY, BOARD, BOARD);
            c.textAlign = 'center'; c.fillStyle = '#39c5cf'; c.font = 'bold 44px "JetBrains Mono", monospace';
            c.fillText('2048!', W / 2, BY + BOARD / 2 - 10);
            c.fillStyle = 'rgba(230,237,243,.92)'; c.font = '16px "JetBrains Mono", monospace';
            c.fillText('C to keep going · Esc to quit', W / 2, BY + BOARD / 2 + 26);
            c.textAlign = 'left';
          }
        }
      });

      function round(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
      }
      function box(c, g, x, label, value, txt) {
        c.fillStyle = g.color(0.12); round(c, x, 18, 100, 50, 8); c.fill();
        c.textAlign = 'center';
        c.fillStyle = g.color(0.8); c.font = '11px "JetBrains Mono", monospace'; c.fillText(label, x + 50, 34);
        c.fillStyle = txt; c.font = 'bold 20px "JetBrains Mono", monospace'; c.fillText(String(value), x + 50, 58);
        c.textAlign = 'left';
      }
      function tile(c, t, k, light, s, v) {
        v = v || t.v;
        var x = BX + pos(t.fx + (t.x - t.fx) * k), y = BY + pos(t.fy + (t.y - t.fy) * k);
        var sz = CS * s, off = (CS - sz) / 2;
        c.fillStyle = (light && TILE_LIGHT[v]) || TILE[v] || '#a371f7';
        round(c, x + off, y + off, sz, sz, 8); c.fill();
        var digits = String(v).length;
        c.fillStyle = v <= 4 ? (light ? '#1f2937' : '#e6edf3') : '#ffffff';
        c.font = 'bold ' + Math.round((digits < 3 ? 46 : digits === 3 ? 38 : digits === 4 ? 30 : 24) * s) + 'px "JetBrains Mono", monospace';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(v), x + CS / 2, y + CS / 2 + 2);
        c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      }
    }
  });
})();
