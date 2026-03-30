/**
 * tetris.js — Pièces teintées par la couleur accent du terminal.
 * Toutes les couleurs lues via ctx.getAccentColor() à chaque frame.
 */
(function() {
  var kH = null;
  function cleanup(ctx) { if(kH){document.removeEventListener('keydown',kH);kH=null;} ctx.stopGame(); }
  function isLight() { return document.documentElement.getAttribute('data-theme')==='light'; }

  // Offsets de teinte pour chaque pièce (variation HSL autour de la couleur accent)
  // On mélange la couleur accent avec des teintes fixes pour garder de la variété
  // tout en restant cohérent avec le thème.
  var PIECE_TINTS = [
    { r:1.0, g:1.0, b:1.0 },   // I — accent pur
    { r:1.0, g:0.85,b:0.3 },   // O — chaud
    { r:0.7, g:0.5, b:1.0 },   // T — violet
    { r:0.4, g:1.0, b:0.55},   // S — vert
    { r:1.0, g:0.35,b:0.35},   // Z — rouge
    { r:0.4, g:0.65,b:1.0 },   // J — bleu
    { r:1.0, g:0.65,b:0.3 },   // L — orange
  ];

  var PIECE_CELLS = [
    [[0,1],[1,1],[2,1],[3,1]],   // I
    [[0,0],[1,0],[0,1],[1,1]],   // O
    [[1,0],[0,1],[1,1],[2,1]],   // T
    [[1,0],[2,0],[0,1],[1,1]],   // S
    [[0,0],[1,0],[1,1],[2,1]],   // Z
    [[0,0],[0,1],[1,1],[2,1]],   // J
    [[2,0],[0,1],[1,1],[2,1]],   // L
  ];

  var ASCII_DECO=['████████╗','╚══██╔══╝','   ██║   ','   ██║   ','   ██║   ','   ╚═╝   ','███████╗ ','╚════██║ ','    ██╔╝ ','   ██╔╝  ','  ██╔╝   ','  ╚═╝    '];

  function rot(cells){
    var cx=0,cy=0; cells.forEach(function(c){cx+=c[0];cy+=c[1];});
    cx=Math.round(cx/cells.length); cy=Math.round(cy/cells.length);
    return cells.map(function(c){return[cx-(c[1]-cy),cy+(c[0]-cx)];});
  }

  // Couleurs vives fixes pour les pièces — indépendantes de l'accent pour la lisibilité
  // Palette chaude — oranges, rouges, ambrés, ors, corail
  var PIECE_COLORS = [
    'rgba(255,80,0,1)',     // I — orange feu
    'rgba(255,210,0,1)',    // O — or
    'rgba(255,50,50,1)',    // T — rouge vif
    'rgba(255,160,0,1)',    // S — ambre
    'rgba(255,100,20,1)',   // Z — orange brûlé
    'rgba(255,0,80,1)',     // J — rouge rosé
    'rgba(240,200,0,1)',    // L — jaune doré
  ];
  var PIECE_GLOW = [
    'rgba(255,80,0,.7)',
    'rgba(255,210,0,.7)',
    'rgba(255,50,50,.7)',
    'rgba(255,160,0,.7)',
    'rgba(255,100,20,.7)',
    'rgba(255,0,80,.7)',
    'rgba(240,200,0,.7)',
  ];

  // Teinte mixte avec l'accent pour le HUD
  function tintedColor(ac, tint, alpha) {
    var r = Math.min(255, Math.round(ac.r * tint.r + 80*(1-tint.r)));
    var g = Math.min(255, Math.round(ac.g * tint.g + 80*(1-tint.g)));
    var b = Math.min(255, Math.round(ac.b * tint.b + 80*(1-tint.b)));
    var lum = r*0.299 + g*0.587 + b*0.114;
    if (lum < 80) { r=Math.min(255,r+100); g=Math.min(255,g+100); b=Math.min(255,b+100); }
    return 'rgba('+r+','+g+','+b+','+(alpha||'1')+')'; 
  }

  window.Terminal.register({
    name:'tetris', help:['tetris','Play Tetris  (arrows + space)','games'],
    run: function(args, ctx) {
      ctx.stopGame(); ctx.hideOutput();
      var COLS=10;
      var vpH=Math.min(window.innerHeight-140,640),vpW=Math.min(window.innerWidth-40,900);
      var HUD_W=110;
      var CS=Math.max(16,Math.min(Math.floor((vpW-HUD_W)/COLS),Math.floor(vpH/22)));
      var ROWS=Math.floor(vpH/CS);
      var gameW=COLS*CS+HUD_W, gameH=ROWS*CS;

      ctx.resizeForGame(gameW,gameH).then(function(){
        var canvas=ctx.canvas; if(!canvas)return;
        var dim=ctx.getGameDimensions(),W=dim.W,H=dim.H;
        CS=Math.max(14,Math.min(Math.floor((W-HUD_W)/COLS),Math.floor(H/22)));
        ROWS=Math.floor(H/CS);
        var boardH=ROWS*CS;
        canvas.style.display='block';canvas.style.height=boardH+'px';
        canvas.width=W;canvas.height=boardH;
        var OX=0,HX=COLS*CS+12;

        var board=[];
        for(var r=0;r<ROWS;r++){board.push([]);for(var c=0;c<COLS;c++)board[r].push(null);}
        // null = empty, {t:tintIndex} = placed cell

        var score=0,lines=0,level=1,dTimer=0,dInt=45,dead=false,frame=0;

        function mkPiece(){
          var t=Math.floor(Math.random()*PIECE_CELLS.length);
          return{cells:PIECE_CELLS[t].map(function(c){return c.slice();}),t:t,x:Math.floor(COLS/2)-1,y:0};
        }
        var cur=mkPiece(),next=mkPiece();

        function valid(cells,px,py){
          return cells.every(function(cell){var bx=cell[0]+px,by=cell[1]+py;return bx>=0&&bx<COLS&&by<ROWS&&(by<0||!board[by][bx]);});
        }
        function lock(){
          cur.cells.forEach(function(cell){var bx=cell[0]+cur.x,by=cell[1]+cur.y;if(by>=0)board[by][bx]={t:cur.t};});
          var cleared=0;
          for(var r=ROWS-1;r>=0;r--){
            if(board[r].every(function(v){return v!==null;})){
              board.splice(r,1);board.unshift([]);for(var c=0;c<COLS;c++)board[0].push(null);cleared++;r++;
            }
          }
          if(cleared){lines+=cleared;score+=[0,100,300,500,800][cleared]*level;level=Math.floor(lines/10)+1;dInt=Math.max(8,45-level*3);}
          cur={cells:next.cells.map(function(c){return c.slice();}),t:next.t,x:Math.floor(COLS/2)-1,y:0};
          next=mkPiece();
          if(!valid(cur.cells,cur.x,cur.y))dead=true;
        }

        kH=function(e){
          if(e.type==='keydown'){
            if(e.key==='ArrowLeft'&&valid(cur.cells,cur.x-1,cur.y))cur.x--;
            if(e.key==='ArrowRight'&&valid(cur.cells,cur.x+1,cur.y))cur.x++;
            if(e.key==='ArrowDown'&&valid(cur.cells,cur.x,cur.y+1))cur.y++;
            if(e.key==='ArrowUp'){var rv=rot(cur.cells);if(valid(rv,cur.x,cur.y))cur.cells=rv;}
            if(e.key===' '){e.preventDefault();while(valid(cur.cells,cur.x,cur.y+1))cur.y++;lock();}
            if(e.key==='Escape'){cleanup(ctx);return;}
            if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
          }
        };
        document.addEventListener('keydown',kH);
        ctx.printLine('🎮 TETRIS — ← → · ↑ rotate · ↓ soft · Space hard · ESC quit','term-out-bold');

        function loop(){
          if(dead){ctx.printLine('GAME OVER — Score: '+score,'term-out-error');cleanup(ctx);return;}
          frame++;
          dTimer++;if(dTimer>=dInt){dTimer=0;if(valid(cur.cells,cur.x,cur.y+1))cur.y++;else lock();}

          var C=canvas.getContext('2d');
          var H2=canvas.height;
          var ac=ctx.getAccentColor(),ar=ac.r,ag=ac.g,ab=ac.b;
          var light=isLight();
          var BG    =light?'#f0f4fc':'#050a12';
          var BORDER='rgba('+ar+','+ag+','+ab+',.5)';
          var GHOST_A=light?'rgba(255,255,255,.15)':'rgba(255,255,255,.1)';
          var HUD_C ='rgba(255,255,255,.95)';
          var HUD_D ='rgba('+ar+','+ag+','+ab+',.6)';

          C.fillStyle=BG;C.fillRect(0,0,W,H2);
          if(!light)for(var sy=0;sy<H2;sy+=4){C.fillStyle='rgba(0,0,0,.05)';C.fillRect(0,sy,W,2);}

          C.strokeStyle=BORDER;C.lineWidth=2;C.strokeRect(OX,0,COLS*CS,H2);

          // Placed cells — couleurs vives fixes
          for(var r=0;r<ROWS;r++) for(var c=0;c<COLS;c++){
            if(!board[r][c])continue;
            var t2=board[r][c].t;
            C.fillStyle=PIECE_COLORS[t2];
            C.shadowColor=PIECE_GLOW[t2]; C.shadowBlur=CS*.4;
            C.fillRect(OX+c*CS+1,r*CS+1,CS-2,CS-2);
            // Inner highlight
            C.fillStyle='rgba(255,255,255,.18)';
            C.fillRect(OX+c*CS+2,r*CS+2,CS-4,Math.round((CS-4)*.35));
            C.shadowBlur=0;
          }

          // Ghost piece (silhouette de la piece courante)
          var gy=cur.y;while(valid(cur.cells,cur.x,gy+1))gy++;
          cur.cells.forEach(function(cell){
            var bx=cell[0]+cur.x,by=cell[1]+gy;
            if(by>=0){
              C.fillStyle=GHOST_A;
              C.strokeStyle=PIECE_COLORS[cur.t].replace(',1)',', .4)');
              C.lineWidth=1;
              C.fillRect(OX+bx*CS+1,by*CS+1,CS-2,CS-2);
              C.strokeRect(OX+bx*CS+1,by*CS+1,CS-2,CS-2);
            }
          });

          // Current piece avec glow fort
          cur.cells.forEach(function(cell){
            var bx=cell[0]+cur.x,by=cell[1]+cur.y;
            if(by>=0){
              C.fillStyle=PIECE_COLORS[cur.t];
              C.shadowColor=PIECE_GLOW[cur.t]; C.shadowBlur=CS*.7;
              C.fillRect(OX+bx*CS+1,by*CS+1,CS-2,CS-2);
              C.fillStyle='rgba(255,255,255,.22)';
              C.fillRect(OX+bx*CS+2,by*CS+2,CS-4,Math.round((CS-4)*.35));
              C.shadowBlur=0;
            }
          });

          // HUD
          var fs=Math.max(10,Math.round(CS*.65)),lh=Math.round(fs*1.6),y0=lh;
          C.font=fs+'px monospace';C.fillStyle=HUD_D;C.fillText('SCORE',HX,y0);
          C.font='bold '+Math.round(fs*1.2)+'px monospace';C.fillStyle=HUD_C;C.fillText(score,HX,y0+lh);
          C.font=fs+'px monospace';C.fillStyle=HUD_D;C.fillText('LINES',HX,y0+lh*2.8);
          C.font='bold '+Math.round(fs*1.2)+'px monospace';C.fillStyle=HUD_C;C.fillText(lines,HX,y0+lh*3.8);
          C.font=fs+'px monospace';C.fillStyle=HUD_D;C.fillText('LEVEL',HX,y0+lh*5.2);
          C.font='bold '+Math.round(fs*1.5)+'px monospace';C.fillStyle=HUD_C;C.fillText(level,HX,y0+lh*6.5);
          C.font=fs+'px monospace';C.fillStyle=HUD_D;C.fillText('NEXT',HX,y0+lh*8);
          var pw=Math.max(9,Math.round(CS*.72));
          next.cells.forEach(function(cell){
            C.fillStyle=PIECE_COLORS[next.t];C.shadowColor=PIECE_GLOW[next.t];C.shadowBlur=pw*.5;
            C.fillRect(HX+cell[0]*pw,y0+lh*8.8+cell[1]*pw,pw-2,pw-2);
            C.fillStyle='rgba(255,255,255,.2)';
            C.fillRect(HX+cell[0]*pw+1,y0+lh*8.8+cell[1]*pw+1,pw-3,Math.round((pw-3)*.35));
            C.shadowBlur=0;
          });
          var decoY=y0+lh*11.5,decoFS=Math.max(7,Math.round(fs*.7));
          C.font=decoFS+'px monospace';C.fillStyle=HUD_D;
          ASCII_DECO.forEach(function(line,i){if(decoY+i*(decoFS+2)<H2-16)C.fillText(line,HX,decoY+i*(decoFS+2));});
          C.font=fs+'px monospace';C.fillStyle=HUD_D;C.fillText('ESC quit',HX,H2-5);

          ctx.gameLoop.set(requestAnimationFrame(loop));
        }
        loop();
      });
    }
  });
})();
