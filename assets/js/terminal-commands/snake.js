/**
 * terminal-commands/snake.js — Snake on the shared game engine (ctx.createGame).
 * 32×20 grid, speed in moves/second (same on every monitor), buffered turns,
 * golden apple bonus, best score saved. Grid/border drawn once in a cached layer.
 */
(function() {
  var COLS = 32, ROWS = 20, CS = 20;
  var DIRS = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1], z: [0, -1], Z: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], q: [-1, 0], Q: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0]
  };

  function freeCell(g) {
    var d = g.data;
    for (var i = 0; i < 500; i++) {
      var x = 1 + Math.floor(Math.random() * (COLS - 2)), y = 1 + Math.floor(Math.random() * (ROWS - 2));
      if (!d.snake.some(function(s) { return s.x === x && s.y === y; }) &&
          !(d.food && d.food.x === x && d.food.y === y)) return { x: x, y: y };
    }
    return { x: 1, y: 1 };
  }

  window.Terminal.register({
    name: 'snake',
    help: ['snake', 'Play Snake  (arrows / WASD)', 'games'],
    run: function(args, ctx) {
      ctx.createGame({
        name: 'snake', title: '🐍 SNAKE', controls: 'arrows / WASD',
        width: COLS * CS, height: ROWS * CS,
        keys: Object.keys(DIRS),

        init: function(g) {
          var d = g.data, cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
          d.snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
          d.dir = [1, 0]; d.queue = [];
          d.speed = 8; d.timer = 0; d.grow = 0;
          d.food = null; d.food = freeCell(g);
          d.gold = null; d.goldTimer = 0; d.eaten = 0;
        },

        onKey: function(g, key, down) {
          if (!down || !DIRS[key]) return;
          var d = g.data, last = d.queue.length ? d.queue[d.queue.length - 1] : d.dir, nd = DIRS[key];
          if (nd[0] === -last[0] && nd[1] === -last[1]) return;     // no U-turn
          if (nd[0] === last[0] && nd[1] === last[1]) return;
          if (d.queue.length < 2) d.queue.push(nd);                  // buffer quick double turns
        },

        update: function(g, dt) {
          var d = g.data;
          if (d.gold && (d.goldTimer -= dt) <= 0) d.gold = null;
          d.timer += dt;
          var step = 1 / d.speed;
          if (d.timer < step) return;
          d.timer -= step;
          if (d.queue.length) d.dir = d.queue.shift();
          var head = { x: d.snake[0].x + d.dir[0], y: d.snake[0].y + d.dir[1] };
          var hitSelf = d.snake.some(function(s, i) { return i < d.snake.length - (d.grow ? 0 : 1) && s.x === head.x && s.y === head.y; });
          if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS || hitSelf) { g.end('GAME OVER'); return; }
          d.snake.unshift(head);
          if (head.x === d.food.x && head.y === d.food.y) {
            g.score += 10; d.grow += 1; d.eaten++;
            d.speed = Math.min(20, 8 + d.eaten * 0.35);
            d.food = freeCell(g);
            if (!d.gold && d.eaten % 5 === 0) { d.gold = freeCell(g); d.goldTimer = 6; }
          } else if (d.gold && head.x === d.gold.x && head.y === d.gold.y) {
            g.score += 50; d.grow += 3; d.gold = null;
          }
          if (d.grow > 0) d.grow--; else d.snake.pop();
        },

        render: function(c, g) {
          var d = g.data, light = g.light(), ac = g.accent();
          var key = ac.r + ',' + ac.g + ',' + ac.b + (light ? 'L' : 'D');
          c.drawImage(g.layer('board', function(l) {
            l.fillStyle = light ? '#e3e6eb' : '#050a12';
            l.fillRect(0, 0, g.W, g.H);
            l.fillStyle = g.color(light ? 0.18 : 0.12);
            for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) l.fillRect(x * CS + CS / 2 - 1, y * CS + CS / 2 - 1, 2, 2);
            l.strokeStyle = g.color(0.5); l.lineWidth = 2; l.strokeRect(1, 1, g.W - 2, g.H - 2);
          }, key), 0, 0, g.W, g.H);

          // food (pulsing) + golden apple
          var pulse = 0.8 + Math.sin(g.t * 8) * 0.2;
          c.shadowColor = 'rgba(255,70,70,.8)'; c.shadowBlur = 12;
          c.fillStyle = '#ff4646';
          c.beginPath(); c.arc(d.food.x * CS + CS / 2, d.food.y * CS + CS / 2, CS * 0.38 * pulse, 0, Math.PI * 2); c.fill();
          if (d.gold) {
            var blink = d.goldTimer > 2 || Math.floor(g.t * 8) % 2 === 0;
            if (blink) {
              c.shadowColor = 'rgba(255,210,0,.9)'; c.fillStyle = '#ffd200';
              c.beginPath(); c.arc(d.gold.x * CS + CS / 2, d.gold.y * CS + CS / 2, CS * 0.42, 0, Math.PI * 2); c.fill();
            }
          }
          c.shadowBlur = 0;

          // snake: body without glow (cheap), head with glow
          var n = d.snake.length;
          for (var i = n - 1; i >= 1; i--) {
            var s = d.snake[i];
            c.fillStyle = g.color(Math.max(0.35, 1 - (i / n) * 0.65));
            c.fillRect(s.x * CS + 2, s.y * CS + 2, CS - 4, CS - 4);
          }
          var h = d.snake[0];
          c.shadowColor = g.color(0.8); c.shadowBlur = 14;
          c.fillStyle = g.color(1);
          c.fillRect(h.x * CS + 1, h.y * CS + 1, CS - 2, CS - 2);
          c.shadowBlur = 0;
          c.fillStyle = light ? '#0b1220' : '#050a12';
          var ex = d.dir[1] !== 0 ? 4 : 0, ey = d.dir[0] !== 0 ? 4 : 0;
          c.fillRect(h.x * CS + CS / 2 - 2 + d.dir[0] * 4 - ex, h.y * CS + CS / 2 - 2 + d.dir[1] * 4 - ey, 4, 4);
          c.fillRect(h.x * CS + CS / 2 - 2 + d.dir[0] * 4 + ex, h.y * CS + CS / 2 - 2 + d.dir[1] * 4 + ey, 4, 4);

          // HUD
          c.font = 'bold 15px "JetBrains Mono", monospace';
          c.fillStyle = light ? 'rgba(17,24,39,.85)' : 'rgba(230,237,243,.9)';
          c.fillText('SCORE ' + g.score, 10, 20);
          c.textAlign = 'right'; c.fillText('BEST ' + Math.max(g.best, g.score), g.W - 10, 20); c.textAlign = 'left';
        }
      });
    }
  });
})();
