/**
 * pong.js — Couleurs relues à chaque frame via ctx.getAccentColor().
 * Terminal redimensionné précisément via ctx.resizeForGame().
 */
(function() {
  var keys = {}, mouseY = null, kH = null, mH = null;

  function cleanup(ctx) {
    if (kH) { document.removeEventListener('keydown', kH); document.removeEventListener('keyup', kH); }
    if (mH)   document.removeEventListener('mousemove', mH);
    kH = mH = null;
    ctx.stopGame();
  }

  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }

  window.Terminal.register({
    name: 'pong', help: ['pong', 'Play Pong  (mouse / W·S)', 'games'],
    run: function(args, ctx) {
      ctx.stopGame(); ctx.hideOutput();

      // Ask for a comfortable game size then resize terminal to fit
      var targetH = Math.max(320, Math.min(500, Math.round(window.innerHeight * 0.55)));
      var targetW = Math.max(500, Math.min(900, Math.round(window.innerWidth  * 0.75)));

      ctx.resizeForGame(targetW, targetH).then(function() {
        var canvas = ctx.canvas; if (!canvas) return;
        var dim = ctx.getGameDimensions();
        var W = dim.W, H = dim.H;
        canvas.style.display = 'block'; canvas.style.height = H + 'px';
        canvas.width = W; canvas.height = H;
        var c = canvas.getContext('2d');

        var PW = Math.max(8, Math.round(W * .016));
        var PH = Math.max(40, Math.round(H * .22));
        var PS = Math.max(3,  Math.round(H * .018));
        var SPEEDS = [2.5, 3.2, 4.0, 4.9, 5.8];
        var speedLevel = 0, pointsPlayed = 0;
        var p1 = { x: 14, y: H/2-PH/2, score: 0 };
        var p2 = { x: W-14-PW, y: H/2-PH/2, score: 0 };
        var ball, aiTarget = H/2, aiSmooth = H/2, aiCtr = 0;

        function resetBall(dir) {
          speedLevel = Math.min(SPEEDS.length-1, Math.floor(pointsPlayed/2));
          var spd = SPEEDS[speedLevel], ang = (0.35 + Math.random()*.35) * (Math.random()>.5?1:-1);
          ball = { x:W/2, y:H/2+(Math.random()-.5)*H*.25, vx:spd*dir, vy:spd*Math.sin(ang), r:Math.max(5,Math.round(H*.018)) };
        }
        resetBall(1);

        kH = function(e) {
          keys[e.key] = (e.type === 'keydown');
          if (e.key === 'Escape') { cleanup(ctx); return; }
          if (['ArrowUp','ArrowDown','w','s','W','S'].includes(e.key)) e.preventDefault();
        };
        mH = function(e) { var r2 = canvas.getBoundingClientRect(); mouseY = e.clientY - r2.top; };
        document.addEventListener('keydown', kH); document.addEventListener('keyup', kH);
        document.addEventListener('mousemove', mH);
        ctx.printLine('🎮 PONG — mouse or W/S  ·  ESC to quit', 'term-out-bold');

        function loop() {
          // Read accent color every frame → instant color changes
          var ac = ctx.getAccentColor();
          var r = ac.r, g = ac.g, b = ac.b;
          var light = isLight();
          var BG   = light ? '#f0f4fc' : '#050a12';
          var PAD  = 'rgba('+r+','+g+','+b+',1)';
          var BALL = 'rgba('+r+','+g+','+b+',1)';
          var GLOW = 'rgba('+r+','+g+','+b+',.7)';
          var LINE = 'rgba('+r+','+g+','+b+',.18)';
          var HUD  = 'rgba(255,255,255,.95)';
          var SCAN = light ? null : 'rgba(0,0,0,.055)';

          c.fillStyle=BG; c.fillRect(0,0,W,H);
          if (SCAN) for(var sy=0;sy<H;sy+=4){c.fillStyle=SCAN;c.fillRect(0,sy,W,2);}
          c.setLineDash([6,6]); c.strokeStyle=LINE; c.lineWidth=1;
          c.beginPath(); c.moveTo(W/2,0); c.lineTo(W/2,H); c.stroke(); c.setLineDash([]);

          if (keys['w']||keys['W']||keys['ArrowUp'])   p1.y=Math.max(0,p1.y-PS);
          if (keys['s']||keys['S']||keys['ArrowDown']) p1.y=Math.min(H-PH,p1.y+PS);
          if (mouseY!==null) p1.y=Math.max(0,Math.min(H-PH,mouseY-PH/2));

          // AI: recalculate target only every 8 frames to avoid jitter
          if (++aiCtr >= 8) {
            aiCtr = 0;
            if (ball.vx > 0) {
              var t=(p2.x-ball.x)/Math.max(.1,ball.vx), pred=ball.y+ball.vy*t;
              var err=(1-Math.min(speedLevel*.12,.55))*PH;
              aiTarget=Math.max(PH/2,Math.min(H-PH/2,pred+(Math.random()-.5)*err));
            } else {
              // Ball going away — drift gently toward center
              aiTarget=H/2;
            }
          }
          // Smooth the target to eliminate micro-trembling (lerp factor 0.08)
          aiSmooth=aiSmooth*0.92+aiTarget*0.08;
          var ai2=p2.y+PH/2, aiSpd=PS*.78;
          var DEAD=6; // deadzone in px — don't move if within this range
          if (ai2 < aiSmooth-DEAD) p2.y=Math.min(H-PH,p2.y+aiSpd);
          else if (ai2 > aiSmooth+DEAD) p2.y=Math.max(0,p2.y-aiSpd);

          ball.x+=ball.vx; ball.y+=ball.vy;
          if (ball.y-ball.r<0){ball.y=ball.r;ball.vy=Math.abs(ball.vy);}
          if (ball.y+ball.r>H){ball.y=H-ball.r;ball.vy=-Math.abs(ball.vy);}

          function hit(pad,dir){var rel=(ball.y-(pad.y+PH/2))/(PH/2),spd=SPEEDS[speedLevel];ball.vx=dir*spd;ball.vy=rel*spd*.75;if(Math.abs(ball.vy)<spd*.2)ball.vy=spd*.2*(ball.vy>=0?1:-1);}
          if(ball.x-ball.r<p1.x+PW&&ball.x>p1.x&&ball.y>p1.y-2&&ball.y<p1.y+PH+2&&ball.vx<0){ball.x=p1.x+PW+ball.r;hit(p1,1);}
          if(ball.x+ball.r>p2.x&&ball.x<p2.x+PW&&ball.y>p2.y-2&&ball.y<p2.y+PH+2&&ball.vx>0){ball.x=p2.x-ball.r;hit(p2,-1);}
          if(ball.x<0){p2.score++;pointsPlayed++;resetBall(-1);}
          if(ball.x>W){p1.score++;pointsPlayed++;resetBall(1);}

          c.fillStyle=PAD; c.shadowColor=GLOW; c.shadowBlur=PW*2;
          c.fillRect(p1.x,p1.y,PW,PH); c.fillRect(p2.x,p2.y,PW,PH);
          // Paddle highlight
          c.fillStyle='rgba(255,255,255,.25)'; c.shadowBlur=0;
          c.fillRect(p1.x+1,p1.y+2,Math.max(1,PW-2),Math.round(PH*.3));
          c.fillRect(p2.x+1,p2.y+2,Math.max(1,PW-2),Math.round(PH*.3));
          c.beginPath(); c.arc(ball.x,ball.y,ball.r,0,Math.PI*2);
          c.fillStyle=BALL; c.shadowColor=GLOW; c.shadowBlur=ball.r*2.5; c.fill(); c.shadowBlur=0;
          // Ball inner shine
          c.beginPath();c.arc(ball.x-ball.r*.25,ball.y-ball.r*.25,ball.r*.3,0,Math.PI*2);
          c.fillStyle='rgba(255,255,255,.5)';c.fill();

          var fs=Math.round(Math.min(W,H)*.07);
          c.font='bold '+fs+'px monospace'; c.fillStyle=HUD; c.textAlign='center';
          c.fillText(p1.score,W*.35,fs+6); c.fillText(p2.score,W*.65,fs+6);
          c.font=Math.round(fs*.5)+'px monospace'; c.fillText('ESC to quit',W/2,H-6);
          c.textAlign='left';
          ctx.gameLoop.set(requestAnimationFrame(loop));
        }
        loop();
      });
    }
  });
})();
