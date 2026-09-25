/**
 * terminal-commands/fun.js — fun & small utility commands.
 * matrix, sl, hack, fortune, cowsay, joke, 8ball, flip, roll, rps, sudo,
 * neofetch, whoami, date, uptime, echo, history, theme, ls / open.
 * Everything is printed with textContent (no HTML injection); `open` only
 * follows same-origin post URLs from search.json.
 */
(function() {
  var T = window.Terminal;
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function out() { return document.getElementById('terminal-output'); }
  function meta(n) { var el = document.querySelector('meta[name="' + n + '"]'); return el ? el.getAttribute('content') || '' : ''; }

  // One animation at a time (matrix, sl, hack); Esc or a new command stops it
  var anim = null;
  function stopAnim(ctx, msg) {
    if (!anim) return;
    clearInterval(anim.timer);
    document.removeEventListener('keydown', anim.esc);
    anim = null;
    if (ctx && msg) ctx.printLine(msg, 'term-out-warn');
  }
  function startAnim(ctx, ms, tick) {
    stopAnim();
    var a = { timer: null, esc: null };
    a.esc = function(e) { if (e.key === 'Escape' || (e.ctrlKey && (e.key === 'c' || e.key === 'C'))) { e.preventDefault(); stopAnim(ctx, '^C'); } };
    document.addEventListener('keydown', a.esc);
    a.timer = setInterval(function() { if (tick() === false) stopAnim(); }, ms);
    anim = a;
  }
  window.TerminalMatrixStop = function(ctx) { stopAnim(ctx, '^C'); };

  // ── matrix ──────────────────────────────────────────────────────────────
  T.register({
    name: 'matrix',
    help: ['matrix', 'Enter the Matrix  (Esc to stop)'],
    run: function(args, ctx) {
      if (anim) { stopAnim(ctx, '^C — Matrix stopped.'); return; }
      var body = out();
      var fw = body ? Math.max(30, Math.min(Math.floor(body.clientWidth / 9), 72)) : 54;
      var chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEF!@#$%';
      ctx.printLine('[ENTERING THE MATRIX...]', 'term-out-bold');
      ctx.printLine('Esc or Ctrl+C to exit.', 'term-out-dim');
      startAnim(ctx, 80, function() {
        var s = '';
        for (var j = 0; j < fw; j++) s += chars[Math.floor(Math.random() * chars.length)];
        ctx.printLine(s, 'term-out-ascii');
      });
    }
  });

  // ── sl — you meant ls, didn't you ──────────────────────────────────────
  var TRAIN = [
    '      ====        ________                ___________ ',
    '  _D _|  |_______/        \\__I_I_____===__|_________| ',
    '   |(_)---  |   H\\________/ |   |        =|___ ___|   ',
    '   /     |  |   H  |  |     |   |         ||_| |_||   ',
    '  |      |  |   H  |__--------------------| [___] |   ',
    '  | ________|___H__/__|_____/[][]~\\_______|       |   ',
    '  |/ |   |-----------I_____I [][] []  D   |=======|__ ',
    '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ',
    ' |/-=|___|=    ||    ||    ||    |_____/~\\___/        ',
    '  \\_/      \\O=====O=====O=====O_/      \\_/            '
  ];
  T.register({
    name: 'sl',
    help: ['sl', 'Steam Locomotive (for ls typos)'],
    run: function(args, ctx) {
      var body = out();
      if (!body) return;
      var pre = document.createElement('div');
      pre.className = 'terminal-line term-out-ascii term-anim';
      body.appendChild(pre);
      var cols = Math.max(40, Math.min(110, Math.floor(body.clientWidth / 7)));
      var x = cols, tw = TRAIN[0].length;
      function spaces(n) { return n > 0 ? new Array(n + 1).join(' ') : ''; }
      startAnim(ctx, 40, function() {
        pre.textContent = TRAIN.map(function(l) {
          var s = x >= 0 ? spaces(x) + l : l.slice(-x);
          return s.slice(0, cols);
        }).join('\n');
        body.scrollTop = body.scrollHeight;
        if (--x < -tw) { pre.remove(); return false; }
      });
    }
  });

  // ── hack — Hollywood hacking ───────────────────────────────────────────
  T.register({
    name: 'hack',
    help: ['hack [target]', 'Hack the mainframe (safely)'],
    run: function(args, ctx) {
      var target = (args.join(' ') || 'mainframe').slice(0, 40);
      var steps = [
        ['Initializing exploit framework v13.37…', 'term-out-dim'],
        ['Resolving ' + target + '… 10.13.37.' + (Math.floor(Math.random() * 250) + 2), 'term-out'],
        ['Scanning ports: 22 ✓  80 ✓  443 ✓  1337 ✓', 'term-out'],
        ['Bypassing firewall ' + pick(['(ancient iptables rule)', '(it was set to ALLOW ALL)', '(asked nicely)']), 'term-out'],
        ['Cracking password…', 'term-out'],
        ['PROGRESS', 'term-out-bold'],
        ['Password found: ' + pick(['hunter2', 'admin', 'password123', 'correct horse battery staple']), 'term-out-warn'],
        ['Downloading the internet… ' + (Math.floor(Math.random() * 900) + 100) + ' TB', 'term-out'],
        ['Planting a harmless rubber duck 🦆', 'term-out'],
        ['ACCESS GRANTED — ' + target.toUpperCase(), 'term-out-bold'],
        ['(nothing was hacked. go patch your servers.)', 'term-out-dim']
      ];
      var i = 0, pct = -1, bar = null;
      startAnim(ctx, 70, function() {
        if (pct >= 0) {
          pct = Math.min(100, pct + 4 + Math.floor(Math.random() * 7));
          var n = Math.round(pct / 5);
          bar.textContent = '[' + new Array(n + 1).join('█') + new Array(21 - n).join('░') + '] ' + pct + '%';
          if (pct >= 100) pct = -1;
          return;
        }
        if (i >= steps.length) return false;
        var st = steps[i++];
        if (st[0] === 'PROGRESS') {
          bar = document.createElement('div');
          bar.className = 'terminal-line term-out-bold';
          out().appendChild(bar);
          pct = 0;
          return;
        }
        ctx.printLine(st[0], st[1]);
      });
    }
  });

  // ── fortune / cowsay / joke / 8ball ────────────────────────────────────
  var FORTUNES = [
    'It works on my machine. — every developer, ever',
    'There is no place like 127.0.0.1',
    'It\'s always DNS.',
    'Backups are worthless. Restores are priceless.',
    'The cloud is just someone else\'s computer.',
    'Weeks of coding can save you hours of planning.',
    'Real admins test in production. Wise admins have a preprod.',
    'Have you tried turning it off and on again?',
    'A good sysadmin automates the job away, then automates the automation.',
    'chmod 777 is not a fix. It\'s a cry for help.',
    'Every "temporary" firewall rule is permanent.',
    'Read the logs. The answer is in the logs. It is always in the logs.',
    'Uptime is a vanity metric. Patch your kernel.',
    'Keep calm and git revert.'
  ];
  var JOKES = [
    ['Why do programmers prefer dark mode?', 'Because light attracts bugs.'],
    ['How many sysadmins does it take to change a light bulb?', 'None — it\'s a hardware problem.'],
    ['Why did the Docker container break up with the VM?', 'It needed more space… but less overhead.'],
    ['What\'s a sysadmin\'s favourite place to relax?', 'The /home directory.'],
    ['Why was the TCP joke not funny?', 'Because you have to acknowledge it first.'],
    ['I would tell you a UDP joke…', '…but you might not get it.'],
    ['Why do Java devs wear glasses?', 'Because they don\'t C#.'],
    ['There are 10 types of people in the world:', 'those who understand binary and those who don\'t.'],
    ['What did the router say to the doctor?', '"It hurts when IP."']
  ];
  var BALL = ['It is certain.', 'Without a doubt.', 'Yes — ship it.', 'Most likely.', 'Signs point to yes.',
    'Reply hazy, check the logs.', 'Ask again after a reboot.', 'Better not tell you now (NDA).',
    'Don\'t count on it.', 'My sources say no.', 'Very doubtful.', 'Not on a Friday.'];

  T.register({ name: 'fortune', help: ['fortune', 'A random IT wisdom'],
    run: function(args, ctx) { ctx.printLine(pick(FORTUNES), 'term-out-info'); } });

  T.register({ name: 'joke', help: ['joke', 'A (bad) sysadmin joke'],
    run: function(args, ctx) {
      var j = pick(JOKES);
      ctx.printLine(j[0], 'term-out');
      ctx.printLine(j[1], 'term-out-bold', 1200);
    } });

  T.register({ name: 'cowsay', help: ['cowsay [text]', 'A cow says your text'],
    run: function(args, ctx) {
      var text = (args.join(' ') || pick(FORTUNES)).slice(0, 200);
      var width = Math.min(38, text.length), words = text.split(' '), lines = [''];
      words.forEach(function(w) {
        while (w.length > width) { if (lines[lines.length - 1]) lines.push(''); lines[lines.length - 1] = w.slice(0, width); w = w.slice(width); lines.push(''); }
        var cur = lines[lines.length - 1];
        if (!w) return;
        if ((cur ? cur + ' ' + w : w).length > width) lines.push(w); else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
      });
      lines = lines.filter(function(l) { return l; });
      function pad(s) { while (s.length < width) s += ' '; return s; }
      var res = [' ' + new Array(width + 3).join('_')];
      lines.forEach(function(l, i) {
        var o = lines.length === 1 ? ['<', '>'] : i === 0 ? ['/', '\\'] : i === lines.length - 1 ? ['\\', '/'] : ['|', '|'];
        res.push(o[0] + ' ' + pad(l) + ' ' + o[1]);
      });
      res.push(' ' + new Array(width + 3).join('-'),
        '        \\   ^__^', '         \\  (oo)\\_______', '            (__)\\       )\\/\\', '                ||----w |', '                ||     ||');
      res.forEach(function(l) { ctx.printLine(l, 'term-out-ascii'); });
    } });

  T.register({ name: '8ball', help: ['8ball <question>', 'Ask the magic 8-ball'],
    run: function(args, ctx) {
      if (!args.length) { ctx.printLine('usage: 8ball <question>', 'term-out-dim'); return; }
      ctx.printLine('🎱 shaking…', 'term-out-dim');
      ctx.printLine('🎱 ' + pick(BALL), 'term-out-bold', 700);
    } });

  // ── flip / roll / rps ──────────────────────────────────────────────────
  T.register({ name: 'flip', aliases: ['coin'], help: ['flip', 'Flip a coin'],
    run: function(args, ctx) { ctx.printLine('🪙 ' + (Math.random() < 0.5 ? 'Heads' : 'Tails'), 'term-out-bold'); } });

  T.register({ name: 'roll', aliases: ['dice'], help: ['roll [NdM]', 'Roll dice, e.g. roll 2d6'],
    run: function(args, ctx) {
      var m = /^(\d{1,2})?d(\d{1,3})$/i.exec(args[0] || 'd6');
      if (!m) { ctx.printLine('usage: roll [NdM]  (e.g. roll 3d6, roll d20)', 'term-out-error'); return; }
      var n = Math.min(20, Math.max(1, +(m[1] || 1))), sides = Math.min(1000, Math.max(2, +m[2])), r = [];
      for (var i = 0; i < n; i++) r.push(1 + Math.floor(Math.random() * sides));
      var sum = r.reduce(function(a, b) { return a + b; }, 0);
      ctx.printLine('🎲 ' + r.join(' + ') + (n > 1 ? ' = ' + sum : ''), 'term-out-bold');
    } });

  T.register({ name: 'rps', help: ['rps <r|p|s>', 'Rock, paper, scissors'],
    run: function(args, ctx) {
      var opts = ['rock', 'paper', 'scissors'], icons = { rock: '🪨', paper: '📄', scissors: '✂️' };
      var me = (args[0] || '').toLowerCase();
      if (me === 'r') me = 'rock'; if (me === 'p') me = 'paper'; if (me === 's') me = 'scissors';
      if (opts.indexOf(me) < 0) { ctx.printLine('usage: rps <rock|paper|scissors>', 'term-out-dim'); return; }
      var cpu = pick(opts), d = (opts.indexOf(me) - opts.indexOf(cpu) + 3) % 3;
      ctx.printLine('you ' + icons[me] + '  vs  ' + icons[cpu] + ' cpu', 'term-out');
      ctx.printLine(d === 0 ? 'Draw.' : d === 1 ? 'You win! 🎉' : 'You lose. The machines are rising.', d === 1 ? 'term-out-bold' : d === 0 ? 'term-out-dim' : 'term-out-warn', 300);
    } });

  // ── sudo ───────────────────────────────────────────────────────────────
  T.register({ name: 'sudo', help: ['sudo <cmd>', 'Try it'],
    run: function(args, ctx) {
      var cmd = args.join(' ');
      if (/rm\s+-rf?\s+\/(\s|$|\*)/.test(cmd) || /rm\s+-fr\s+\//.test(cmd)) {
        ctx.printLine('rm: it is dangerous to operate recursively on \'/\'', 'term-out-error');
        ctx.printLine('Nice try. This terminal runs in your browser anyway. 😉', 'term-out-dim', 400);
        return;
      }
      if (!cmd) { ctx.printLine('usage: sudo <command>', 'term-out-dim'); return; }
      ctx.printLine('[sudo] password for guest: ********', 'term-out-dim');
      ctx.printLine('guest is not in the sudoers file. This incident will be reported. 🚨', 'term-out-error', 600);
    } });

  // ── neofetch / whoami / date / uptime / echo / history ─────────────────
  T.register({ name: 'neofetch', help: ['neofetch', 'Show the system banner again'],
    run: function(args, ctx) { if (ctx.neofetch) ctx.neofetch(); } });

  T.register({ name: 'whoami', help: ['whoami', 'Who are you?'],
    run: function(args, ctx) {
      ctx.printLine('guest', 'term-out-bold');
      ctx.printLine('visiting ' + (meta('term-boot-host') || location.hostname) + ' · ' +
        (ctx.isTouch() ? 'touch device' : 'desktop') + ' · ' + window.innerWidth + '×' + window.innerHeight +
        ' · ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'), 'term-out-dim');
    } });

  T.register({ name: 'date', help: ['date', 'Current date and time'],
    run: function(args, ctx) { ctx.printLine(new Date().toString(), 'term-out'); } });

  T.register({ name: 'uptime', help: ['uptime', 'Time spent on this page'],
    run: function(args, ctx) {
      var s = Math.floor(performance.now() / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
      var la = [0, 0, 0].map(function() { return (Math.random() * 1.5).toFixed(2); }).join(', ');
      ctx.printLine(' ' + new Date().toTimeString().slice(0, 8) + ' up ' + (h ? h + 'h ' : '') + m + 'm ' + (s % 60) + 's,  1 user,  load average: ' + la, 'term-out');
    } });

  T.register({ name: 'echo', help: ['echo <text>', 'Print text'],
    run: function(args, ctx) { ctx.printLine(args.join(' ').slice(0, 500), 'term-out'); } });

  T.register({ name: 'history', help: ['history', 'Command history'],
    run: function(args, ctx) {
      var h = (ctx.history ? ctx.history() : []).slice(0, 20).reverse();
      if (!h.length) { ctx.printLine('(empty)', 'term-out-dim'); return; }
      h.forEach(function(c, i) { ctx.printLine(('   ' + (i + 1)).slice(-4) + '  ' + c, 'term-out'); });
    } });

  // ── theme ──────────────────────────────────────────────────────────────
  T.register({ name: 'theme', help: ['theme [dark|light]', 'Switch the site theme'],
    run: function(args, ctx) {
      var cur = document.documentElement.getAttribute('data-theme') || 'dark';
      var want = (args[0] || '').toLowerCase();
      if (want && want !== 'dark' && want !== 'light') { ctx.printLine('usage: theme [dark|light]', 'term-out-error'); return; }
      if (!want) want = cur === 'dark' ? 'light' : 'dark';
      if (want !== cur) {
        var btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.click();
        else { document.documentElement.setAttribute('data-theme', want); try { localStorage.setItem('infops-theme', want); } catch (e) {} }
      }
      ctx.printLine('theme → ' + want, 'term-out-bold');
    } });

  // ── ls / open — browse the posts (search.json) ─────────────────────────
  var postsCache = null;
  function loadPosts() {
    if (postsCache) return postsCache;
    var url = meta('search-json-url') || '/search.json';
    postsCache = fetch(url, { credentials: 'same-origin' })
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(list) { return Array.isArray(list) ? list : []; })
      .catch(function(e) { postsCache = null; throw e; });
    return postsCache;
  }
  function sameOrigin(u) {
    try { var x = new URL(u, location.href); return x.origin === location.origin ? x.href : null; } catch (e) { return null; }
  }

  T.register({ name: 'ls', aliases: ['posts'], help: ['ls [filter]', 'List the articles'],
    run: function(args, ctx) {
      var q = args.join(' ').toLowerCase();
      loadPosts().then(function(posts) {
        var list = posts.map(function(p, i) { return { n: i + 1, p: p }; }).filter(function(o) {
          return !q || (o.p.title + ' ' + o.p.tags + ' ' + o.p.categories).toLowerCase().indexOf(q) >= 0;
        });
        if (!list.length) { ctx.printLine('ls: no article matches "' + q + '"', 'term-out-dim'); return; }
        list.forEach(function(o) { ctx.printLine(('  ' + o.n).slice(-3) + '  ' + o.p.date + '  ' + o.p.title, 'term-out'); });
        ctx.printLine('open <number> to read one', 'term-out-dim');
      }).catch(function() { ctx.printLine('ls: cannot read the article index', 'term-out-error'); });
    } });

  T.register({ name: 'open', aliases: ['cd'], help: ['open <n|text>', 'Open an article (see ls)'],
    run: function(args, ctx) {
      var q = args.join(' ').toLowerCase();
      if (!q) { ctx.printLine('usage: open <number|words>  (see ls)', 'term-out-dim'); return; }
      if (q === '~' || q === '/' || q === 'home') { location.href = sameOrigin((document.querySelector('.navbar-brand a') || {}).href || '/') || '/'; return; }
      loadPosts().then(function(posts) {
        var p = /^\d+$/.test(q) ? posts[+q - 1] : posts.filter(function(x) { return x.title.toLowerCase().indexOf(q) >= 0; })[0];
        var href = p && sameOrigin(p.url);
        if (!href) { ctx.printLine('open: no such article: ' + q, 'term-out-error'); return; }
        ctx.printLine('→ ' + p.title, 'term-out-bold');
        setTimeout(function() { location.href = href; }, 300);
      }).catch(function() { ctx.printLine('open: cannot read the article index', 'term-out-error'); });
    } });
})();
