'use strict';
(function() {

  var input    = document.getElementById('terminal-input');
  var output   = document.getElementById('terminal-output');
  var canvas   = document.getElementById('term-game-canvas');
  var inputRow = document.getElementById('terminal-input-row');
  var win      = document.getElementById('hero-terminal');
  var overlay  = document.getElementById('term-fs-overlay');

  if (!input || !output) return;

  var history    = [];
  var histIdx    = -1;
  var _gameLoop  = null;
  var _isFs      = false;
  var _fsPlaceholder = null;
  var _userColor = null;  // "r,g,b" string or null
  var _gameMode  = false;
  var _savedWinH = '';
  var _savedMaxW = '';

  // ── Public API ──────────────────────────────────────────────────────────
  var commands = {};
  var ctx = {
    printLine:   printLine,
    printLines:  printLines,
    clearOutput: clearOutput,
    stopGame:    stopGame,
    showOutput:  showOutput,
    hideOutput:  hideOutput,
    canvas:      canvas,
    inputRow:    inputRow,
    isFullscreen: function() { return _isFs; },

    // Always current accent {r,g,b} — read every frame in games
    getAccentColor: function() {
      if (_userColor) {
        var p = _userColor.split(',');
        return { r: +p[0], g: +p[1], b: +p[2] };
      }
      return document.documentElement.getAttribute('data-theme') === 'light'
        ? { r: 37,  g: 99,  b: 235 }
        : { r: 88,  g: 166, b: 255 };
    },

    getGameDimensions: function() {
      if (!win) return { W: 600, H: 400 };
      var hdr  = win.querySelector('.terminal-header');
      var hdrH = hdr ? hdr.offsetHeight : 44;
      return { W: win.clientWidth || 600, H: Math.max(200, (win.clientHeight || 400) - hdrH - 4) };
    },

    // Resize terminal to fit the game exactly, returns Promise
    resizeForGame: function(gameW, gameH) {
      return new Promise(function(resolve) {
        if (_isFs || !win) { resolve(); return; }
        if (!_gameMode) {
          _gameMode  = true;
          _savedWinH = win.style.height  || '';
          _savedMaxW = win.style.maxWidth || '';
        }
        var hdr  = win.querySelector('.terminal-header');
        var hdrH = hdr ? hdr.offsetHeight : 44;
        var vpH  = window.innerHeight - 120;
        var vpW  = window.innerWidth  - 40;
        win.style.height   = Math.min(gameH + hdrH + 4, vpH) + 'px';
        win.style.maxWidth = Math.min(gameW, vpW) + 'px';
        win.classList.add('game-mode');
        requestAnimationFrame(function() { requestAnimationFrame(resolve); });
      });
    },

    enterGameMode: function() {
      if (_gameMode || _isFs || !win) return;
      _gameMode  = true;
      _savedWinH = win.style.height  || '';
      _savedMaxW = win.style.maxWidth || '';
      win.style.height   = Math.max(460, Math.min(640, Math.round(window.innerHeight * 0.62))) + 'px';
      win.style.maxWidth = '900px';
      win.classList.add('game-mode');
    },

    exitGameMode: function() { exitGameMode(); },
    gameLoop: { get: function() { return _gameLoop; }, set: function(v) { _gameLoop = v; } }
  };

  function exitGameMode() {
    if (!_gameMode || !win) return;
    _gameMode = false;
    win.style.height   = _savedWinH;
    win.style.maxWidth = _savedMaxW;
    win.classList.remove('game-mode');
    _savedWinH = _savedMaxW = '';
  }

  window.Terminal = {
    register: function(def) {
      if (!def || !def.name || typeof def.run !== 'function') { console.warn('[Terminal] register() needs {name, run}', def); return; }
      commands[def.name] = def;
      if (def.aliases) def.aliases.forEach(function(a) { commands[a] = def; });
    },
    get commands() { return commands; },
    ctx: ctx
  };

  // ── Focus ───────────────────────────────────────────────────────────────
  if (win) win.addEventListener('click', function(e) {
    if (!e.target.closest('.dot') && !e.target.closest('.term-game-canvas')) input.focus();
  });
  if (overlay) overlay.addEventListener('click', exitFullscreen);

  // ── Theme change ─────────────────────────────────────────────────────────
  window.addEventListener('themechange', function() {
    if (!win) return;
    if (_userColor) {
      var p = _userColor.split(',');
      win.style.setProperty('--term-color', _userColor);
      applyWindowStyle(+p[0], +p[1], +p[2]);
    } else {
      win.style.removeProperty('--term-color');
      applyWindowStyle(null);
    }
  });

  // ── Keyboard ─────────────────────────────────────────────────────────────
  input.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault(); input.value = ''; histIdx = -1;
      stopGame();
      if (typeof window.TerminalMatrixStop === 'function') window.TerminalMatrixStop(ctx);
      return;
    }
    if (e.key === 'Escape') {
      if (_gameLoop) { e.preventDefault(); stopGame(); return; }
      if (_isFs)     { e.preventDefault(); exitFullscreen(); return; }
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < history.length - 1) { histIdx++; input.value = history[histIdx]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      histIdx > 0 ? (histIdx--, input.value = history[histIdx]) : (histIdx = -1, input.value = '');
    }
  });

  input.addEventListener('keypress', function(e) {
    if (e.key !== 'Enter') return;
    var raw = input.value.trim(); input.value = ''; histIdx = -1;
    if (!raw) return;
    history.unshift(raw);
    printLine('$ ' + raw, 'term-out-dim');
    if (handleEasterEgg(raw)) return;
    runCommand(raw.toLowerCase());
  });

  function handleEasterEgg(raw) {
    var m = raw.match(/^setcolor\s+#?([0-9a-fA-F]{6})$/i);
    if (!m) return false;
    applyColor(m[1]);
    printLine('Color → #' + m[1].toUpperCase(), 'term-out-bold');
    return true;
  }

  // ── applyColor ───────────────────────────────────────────────────────────
  function applyColor(hex) {
    if (hex === null) {
      _userColor = null;
      if (win) win.style.removeProperty('--term-color');
      applyWindowStyle(null);
      try { sessionStorage.removeItem('infops-term-color'); } catch(e) {}
      return;
    }
    var r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    _userColor = r+','+g+','+b;
    if (win) win.style.setProperty('--term-color', _userColor);
    applyWindowStyle(r, g, b);
    try { sessionStorage.setItem('infops-term-color', _userColor); } catch(e) {}
  }

  // ── applyWindowStyle ─────────────────────────────────────────────────────
  function applyWindowStyle(r, g, b) {
    if (!win) return;
    var header = win.querySelector('.terminal-header');
    if (r === null) {
      ['background','border-color','box-shadow'].forEach(function(p){ win.style.removeProperty(p); });
      if (header) { header.style.removeProperty('background'); header.style.removeProperty('border-bottom-color'); }
      var old = document.getElementById('term-custom-sweep');
      if (old) old.parentNode.removeChild(old);
      return;
    }
    var a05='rgba('+r+','+g+','+b+',.05)',a08='rgba('+r+','+g+','+b+',.08)',
        a12='rgba('+r+','+g+','+b+',.12)',a18='rgba('+r+','+g+','+b+',.18)',
        a22='rgba('+r+','+g+','+b+',.22)',a35='rgba('+r+','+g+','+b+',.035)',
        a07='rgba('+r+','+g+','+b+',.07)';
    var bgR=Math.round(r*.05+7*.95),bgG=Math.round(g*.05+13*.95),bgB=Math.round(b*.05+24*.95);
    var hR=Math.round(r*.08+10*.92),hG=Math.round(g*.08+22*.92),hB=Math.round(b*.08+40*.92);
    var isLight=document.documentElement.getAttribute('data-theme')==='light';
    if (!isLight) {
      win.style.background='rgb('+bgR+','+bgG+','+bgB+')'; win.style.borderColor=a22;
      win.style.boxShadow='0 0 0 1px '+a08+', 0 20px 40px rgba(0,0,0,.5), 0 0 60px '+a05;
      if (header){header.style.background='rgb('+hR+','+hG+','+hB+')';header.style.borderBottomColor=a12;}
    } else {
      var lr=Math.min(255,Math.round(242+r*.05)),lg2=Math.min(255,Math.round(246+g*.04)),lb=Math.min(255,Math.round(254+b*.01));
      win.style.background='rgb('+lr+','+lg2+','+lb+')'; win.style.borderColor=a22;
      win.style.boxShadow='0 0 0 1px '+a12+', 0 12px 32px '+a12+', 0 4px 16px rgba(0,0,0,.07)';
      var ehr=Math.min(255,Math.round(232+r*.09)),ehg=Math.min(255,Math.round(240+g*.06)),ehb=Math.min(255,Math.round(254+b*.02));
      if (header){header.style.background='rgb('+ehr+','+ehg+','+ehb+')';header.style.borderBottomColor=a18;}
    }
    var old=document.getElementById('term-custom-sweep');
    if (old) old.parentNode.removeChild(old);
    var style=document.createElement('style'); style.id='term-custom-sweep';
    style.textContent=
      '#hero-terminal::before{background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba('+r+','+g+','+b+',.025) 2px,rgba('+r+','+g+','+b+',.025) 4px) !important;}'+
      '#hero-terminal::after{background:linear-gradient(to bottom,transparent 45%,'+a35+' 48%,'+a07+' 50%,'+a35+' 52%,transparent 55%) !important;}';
    document.head.appendChild(style);
  }

  window.TerminalApplyColor = applyColor;

  // ── Print ────────────────────────────────────────────────────────────────
  function printLine(text, cls, delay) {
    setTimeout(function() {
      var line = document.createElement('div');
      line.className = 'terminal-line ' + (cls || 'term-out');
      line.style.cssText = 'opacity:1;transform:none;animation:none;';
      line.textContent = text;
      output.appendChild(line);
      output.scrollTop = output.scrollHeight;
    }, delay || 0);
  }
  function printLines(arr, cls, base) { arr.forEach(function(l,i){ printLine(l,cls||'term-out',(base||0)+i*55); }); }
  function clearOutput() { output.innerHTML = ''; }
  function hideOutput()  { if(output)output.style.display='none'; if(inputRow)inputRow.style.display='none'; }
  function showOutput()  { if(output)output.style.removeProperty('display'); if(inputRow)inputRow.style.removeProperty('display'); }

  function setStatus(connected) {
    var txt=document.getElementById('term-status-text');
    var dot=win?win.querySelector('.pulse-dot'):null;
    if(txt)txt.textContent=connected?'connected':'disconnected';
    if(dot)dot.style.background=connected?'':'#f85149';
  }

  // ── Window controls ──────────────────────────────────────────────────────
  window.heroTerminalClose = function() { stopGame(); exitFullscreen(); if(win)win.style.display='none'; };
  window.heroTerminalMin   = function() { if(!win)return; stopGame(); setStatus(!win.classList.toggle('minimized')); };
  window.heroTerminalFull  = function() { _isFs ? exitFullscreen() : enterFullscreen(); };

  function enterFullscreen() {
    if(!win||_isFs)return;
    exitGameMode(); _isFs=true;
    var nav=document.querySelector('.main-header, header');
    if(nav)document.documentElement.style.setProperty('--navbar-h',nav.offsetHeight+'px');
    _fsPlaceholder=document.createElement('div');
    _fsPlaceholder.style.cssText='width:'+win.offsetWidth+'px;height:'+win.offsetHeight+'px;margin:0 auto 2.5rem;max-width:680px;pointer-events:none;visibility:hidden;';
    win.parentNode.insertBefore(_fsPlaceholder,win);
    document.body.appendChild(win);
    win.classList.add('fullscreen'); document.body.classList.add('term-fullscreen');
    if(overlay)overlay.classList.add('active');
    _setFsIcon(true); setTimeout(function(){input.focus();},50);
  }

  function exitFullscreen() {
    if(!win||!_isFs)return;
    _isFs=false; win.classList.remove('fullscreen'); document.body.classList.remove('term-fullscreen');
    if(_fsPlaceholder&&_fsPlaceholder.parentNode){_fsPlaceholder.parentNode.insertBefore(win,_fsPlaceholder);_fsPlaceholder.parentNode.removeChild(_fsPlaceholder);}
    _fsPlaceholder=null;
    if(overlay)overlay.classList.remove('active');
    _setFsIcon(false); setTimeout(function(){input.focus();},50);
  }

  function _setFsIcon(fs) {
    var ic=document.getElementById('dot-full-icon'),dt=document.getElementById('dot-full');
    if(!ic)return;
    ic.innerHTML=fs
      ?'<polyline points="4,1 1,1 1,4"/><polyline points="9,4 9,1 6,1"/><polyline points="6,9 9,9 9,6"/><polyline points="1,6 1,9 4,9"/>'
      :'<polyline points="1,4 1,1 4,1"/><polyline points="6,1 9,1 9,4"/><polyline points="9,6 9,9 6,9"/><polyline points="4,9 1,9 1,6"/>';
    if(dt)dt.title=fs?'Exit fullscreen':'Fullscreen';
  }

  function stopGame() {
    if(_gameLoop){cancelAnimationFrame(_gameLoop);_gameLoop=null;}
    if(canvas)canvas.style.display='none';
    exitGameMode(); showOutput();
    setTimeout(function(){if(input)input.focus();},50);
  }

  function runCommand(raw) {
    var parts=raw.split(/\s+/),name=parts[0].replace(/^\//,''),args=parts.slice(1);
    if(name==='exit'||name==='quit'){printLine('logout','term-out-dim');setTimeout(function(){window.heroTerminalClose();},400);return;}
    if(commands[name]){commands[name].run(args,ctx);return;}
    printLine('-bash: '+parts[0]+': command not found','term-out-error');
    printLine("Type /help for available commands.",'term-out-dim');
  }

  function metaVal(name) {
    var el=document.querySelector('meta[name="'+name+'"]');
    return el?(el.getAttribute('content')||''):'';
  }

  // ── Boot — neofetch with configurable ASCII art ───────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    // Restore saved color
    try {
      var saved=sessionStorage.getItem('infops-term-color');
      if(saved){_userColor=saved;if(win)win.style.setProperty('--term-color',saved);var sp=saved.split(',');if(sp.length===3)applyWindowStyle(+sp[0],+sp[1],+sp[2]);}
    } catch(e){}

    var user  = metaVal('term-boot-user')  || 'YOUR_USER';
    var host  = metaVal('term-boot-host')  || 'YOUR_HOST';
    var os    = metaVal('term-boot-os')    || 'YOUR_OS';
    var shell = metaVal('term-boot-shell') || 'YOUR_SHELL';
    var role  = metaVal('term-boot-role')  || 'YOUR_ROLE';
    var line1 = metaVal('term-boot-line1');
    var line2 = metaVal('term-boot-line2');
    var motd  = metaVal('term-boot-motd')  || "Type /help for all commands.";
    var posts = metaVal('term-boot-posts') || '?';

    var s = Math.floor(performance.now() / 1000);
    var uptime = s < 60 ? s+'s' : s < 3600 ? Math.floor(s/60)+'m '+(s%60)+'s' : Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m';

    var id  = user+'@'+host;
    var bar = ''; for(var bi=0;bi<Math.min(id.length,30);bi++) bar+='─';

    var info = [id, bar,
      'OS:     '+os,
      'Shell:  '+shell,
      'Uptime: '+uptime,
      'Posts:  '+posts,
    ];
    if(role  && role  !== 'YOUR_ROLE')  info.push('Role:   '+role);
    if(line1 && line1 !== '')           info.push(line1);
    if(line2 && line2 !== '')           info.push(line2);

    // ASCII art: custom from config or default Ubuntu-style logo
    var customAscii = metaVal('term-boot-ascii');
    var logo;
    if (customAscii && customAscii.indexOf('YOUR_ASCII') === -1 && customAscii.trim() !== '') {
      logo = customAscii.split('\n').map(function(l){ return l; });
      // Pad/trim to reasonable count
      while (logo.length < 3) logo.push('');
    } else {
      logo = [
        '        .:-/+oossssoo+/-.   ',
        '    .:+ssssssssssssssssss+:.',
        '  -+ssssssssssssssssssyyssss+-',
        ' ossssssssssssssssssssNMssssso',
        ' ssssssssssssssssssssMMMMssss ',
        ' ossssssssssssssssssssNMssso  ',
        '  -+sssssssssssssssssyyssss+- ',
        '    .:+ssssssssssssssssss+:.  ',
        '        .::-/+oossssoo+/-.    ',
      ];
    }

    var PAD = Math.max.apply(null, logo.map(function(l){return l.length;})) + 2;
    function pad(s,n){var o=s||'';while(o.length<n)o+=' ';return o.slice(0,n);}

    var rows = Math.max(logo.length, info.length);
    for(var i=0;i<rows;i++) printLine(pad(logo[i]||'',PAD)+(info[i]||''),'term-out-ascii');

    printLine('','term-out-dim');
    printLine('  '+motd,'term-out-bold');
    printLine('','term-out-dim');
    setTimeout(function(){input.focus();},150);
  });

})();
