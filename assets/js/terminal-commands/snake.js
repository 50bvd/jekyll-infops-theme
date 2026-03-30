/**
 * snake.js — resizeForGame() exact, couleurs relues à chaque frame.
 */
(function() {
  var kH = null;
  function cleanup(ctx) { if(kH)document.removeEventListener('keydown',kH); kH=null; ctx.stopGame(); }
  function isLight() { return document.documentElement.getAttribute('data-theme')==='light'; }

  window.Terminal.register({
    name:'snake', help:['snake','Play Snake  (arrow keys / WASD)','games'],
    run: function(args, ctx) {
      ctx.stopGame(); ctx.hideOutput();

      var CS = 16;
      var vpH = Math.min(window.innerHeight - 140, 560);
      var vpW = Math.min(window.innerWidth  - 40,  860);
      var COLS = Math.floor(vpW / CS), ROWS = Math.floor(vpH / CS);
      var gameW = COLS * CS, gameH = ROWS * CS;

      ctx.resizeForGame(gameW, gameH).then(function() {
        var canvas=ctx.canvas; if(!canvas)return;
        // Refit to actual terminal
        var dim=ctx.getGameDimensions();
        CS = Math.max(12, Math.min(Math.floor(dim.W/COLS), Math.floor(dim.H/ROWS)));
        COLS = Math.floor(dim.W / CS);
        ROWS = Math.floor(dim.H / CS);
        var W = dim.W, H = dim.H;
        canvas.style.display='block'; canvas.style.height=H+'px';
        canvas.width=W; canvas.height=H;

        var snake,dx,dy,ndx,ndy,food,score,tick,speed,dead2;

        function init(){
          var sx=Math.floor(COLS/2),sy=Math.floor(ROWS/2);
          snake=[{x:sx,y:sy},{x:sx-1,y:sy},{x:sx-2,y:sy}];
          dx=1;dy=0;ndx=1;ndy=0;score=0;tick=0;speed=14;dead2=false;
          placeFood();
        }
        function placeFood(){
          var t=0;
          do{food={x:Math.floor(Math.random()*(COLS-2))+1,y:Math.floor(Math.random()*(ROWS-2))+1};t++;}
          while(t<200&&snake.some(function(s){return s.x===food.x&&s.y===food.y;}));
        }
        init();

        kH=function(e){
          if((e.key==='ArrowLeft'||e.key==='a'||e.key==='A')&&dx!==1){ndx=-1;ndy=0;}
          if((e.key==='ArrowRight'||e.key==='d'||e.key==='D')&&dx!==-1){ndx=1;ndy=0;}
          if((e.key==='ArrowUp'||e.key==='w'||e.key==='W')&&dy!==1){ndx=0;ndy=-1;}
          if((e.key==='ArrowDown'||e.key==='s'||e.key==='S')&&dy!==-1){ndx=0;ndy=1;}
          if(e.key==='Escape'){cleanup(ctx);}
          if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))e.preventDefault();
        };
        document.addEventListener('keydown',kH);
        ctx.printLine('🐍 SNAKE — Arrow keys / WASD  ·  ESC to quit','term-out-bold');

        function loop(){
          tick++;
          var C=canvas.getContext('2d');

          // Read accent color every frame
          var ac=ctx.getAccentColor(),ar=ac.r,ag=ac.g,ab=ac.b;
          var light=isLight();
          var BG    =light?'#f0f4fc':'#050a12';
          var SH    ='rgba('+ar+','+ag+','+ab+',1)';
          var SB    ='rgba('+ar+','+ag+','+ab+',.7)';
          var SGLOW ='rgba('+ar+','+ag+','+ab+',.7)';
          var FC    ='rgba(255,60,60,1)';
          var FG    ='rgba(255,60,60,.7)';
          var GRID  ='rgba('+ar+','+ag+','+ab+',.06)';
          var BORDER='rgba('+ar+','+ag+','+ab+',.5)';
          var HUD   ='rgba(255,255,255,.9)';

          C.fillStyle=BG; C.fillRect(0,0,W,H);
          if(!light) for(var sy=0;sy<H;sy+=4){C.fillStyle='rgba(0,0,0,.05)';C.fillRect(0,sy,W,2);}

          // Grid dots
          C.fillStyle=GRID;
          for(var gr=1;gr<ROWS-1;gr++) for(var gc=1;gc<COLS-1;gc++) C.fillRect(gc*CS+CS/2-1,gr*CS+CS/2-1,1,1);

          // Border with accent color
          C.strokeStyle=BORDER; C.lineWidth=2; C.strokeRect(1,1,W-2,H-2);

          // Food
          var pulse=0.72+Math.sin(tick*.16)*.28;
          C.beginPath();C.arc(food.x*CS+CS/2,food.y*CS+CS/2,CS*.42*pulse,0,Math.PI*2);
          C.fillStyle=FC;C.shadowColor=FG;C.shadowBlur=CS*.7;C.fill();C.shadowBlur=0;
          // Food inner shine
          C.beginPath();C.arc(food.x*CS+CS/2-CS*.08,food.y*CS+CS/2-CS*.08,CS*.1,0,Math.PI*2);
          C.fillStyle='rgba(255,255,255,.7)';C.fill();

          // Snake
          snake.forEach(function(seg,i){
            var segAlpha=i===0?1:Math.max(.4, 1-i*(0.6/Math.max(snake.length,1)));
            C.fillStyle=i===0?SH:'rgba('+ar+','+ag+','+ab+','+segAlpha+')';
            C.shadowColor=SGLOW;
            C.shadowBlur=i===0?CS*.6:CS*.2;
            C.fillRect(seg.x*CS+1,seg.y*CS+1,CS-2,CS-2);
            C.shadowBlur=0;
            // Head highlight
            if(i===0){
              C.fillStyle='rgba(255,255,255,.3)';
              C.fillRect(seg.x*CS+2,seg.y*CS+2,CS-4,Math.round((CS-4)*.4));
            }
          });

          var fs=Math.max(10,Math.round(CS*.85));
          C.font='bold '+fs+'px monospace';C.fillStyle=HUD;
          C.fillText('SCORE: '+score,5,H-5); C.fillText('ESC',W-fs*2.2,H-5);

          if(dead2){
            C.fillStyle='rgba(248,81,73,.9)';var gofs=Math.round(H*.06);
            C.font='bold '+gofs+'px monospace';C.textAlign='center';C.fillText('GAME OVER',W/2,H/2);
            C.font=Math.round(gofs*.65)+'px monospace';C.fillStyle=HUD;C.fillText('Score: '+score,W/2,H/2+gofs*.9);
            C.textAlign='left';ctx.gameLoop.set(requestAnimationFrame(loop));return;
          }

          if(tick%speed!==0){ctx.gameLoop.set(requestAnimationFrame(loop));return;}
          dx=ndx;dy=ndy;
          var head={x:snake[0].x+dx,y:snake[0].y+dy};
          if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||snake.some(function(s){return s.x===head.x&&s.y===head.y;})){
            dead2=true;ctx.printLine('GAME OVER — Score: '+score,'term-out-error');
            ctx.gameLoop.set(requestAnimationFrame(loop));return;
          }
          snake.unshift(head);
          if(head.x===food.x&&head.y===food.y){score+=10;placeFood();if(score%50===0)speed=Math.max(5,speed-1);}
          else snake.pop();
          ctx.gameLoop.set(requestAnimationFrame(loop));
        }
        loop();
      });
    }
  });
})();
