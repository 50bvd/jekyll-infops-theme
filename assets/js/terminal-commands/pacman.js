/**
 * pacman.js — 4 fantômes avec ghost house, comportements individuels,
 * couleurs vives + glow, contrôles WASD/flèches buffered.
 */
(function() {
  var kH = null, active = false;
  function cleanup(ctx) { active=false; if(kH){document.removeEventListener('keydown',kH);kH=null;} ctx.stopGame(); }
  function isLight() { return document.documentElement.getAttribute('data-theme')==='light'; }

  // ── Carte 21×13 avec ghost house central ───────────────────────────────
  // 0=dot  1=wall  2=empty  3=power  4=ghosthouse(door)  5=ghosthouse(floor)
  var MAP = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,3,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,3,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,1,4,1,0,0,0,1,0,0,0,0,1],
    [1,1,1,1,0,1,0,1,2,1,5,1,2,1,0,1,0,1,1,1,1],
    [2,2,2,2,0,1,0,1,5,5,5,5,5,1,0,1,0,2,2,2,2],
    [1,1,1,1,0,1,0,1,1,1,1,1,1,1,0,1,0,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0,1],
    [1,3,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,3,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];
  var MR=MAP.length, MC=MAP[0].length;
  var PAC_START={x:10,y:9};
  // Ghost house positions + release order + colors + behavior
  var GHOST_DEFS = [
    { x:10, y:6, color:'rgba(255,60,60,1)',   name:'blinky', releaseAt:0,   mode:'chase'  },  // rouge
    { x:9,  y:7, color:'rgba(255,180,255,1)', name:'pinky',  releaseAt:30,  mode:'house'  },  // rose
    { x:10, y:7, color:'rgba(0,220,255,1)',   name:'inky',   releaseAt:80,  mode:'house'  },  // cyan
    { x:11, y:7, color:'rgba(255,175,60,1)',  name:'clyde',  releaseAt:140, mode:'house'  },  // orange
  ];
  var DOOR_Y = 5, DOOR_X = 10;  // ghost house exit cell

  window.Terminal.register({
    name:'pacman', help:['pacman','Play Pac-Man  (WASD / arrow keys)','games'],
    run: function(args, ctx) {
      ctx.stopGame(); active=false;

      var vpH=Math.min(window.innerHeight-140,560);
      var vpW=Math.min(window.innerWidth-40,860);
      var CS=Math.max(16,Math.min(Math.floor(vpW/MC),Math.floor(vpH/MR)));
      ctx.hideOutput();
      ctx.resizeForGame(MC*CS, MR*CS).then(function(){
        var canvas=ctx.canvas; if(!canvas)return;
        var dim=ctx.getGameDimensions();
        CS=Math.max(14,Math.min(Math.floor(dim.W/MC),Math.floor(dim.H/MR)));
        var W=MC*CS, H=MR*CS;
        canvas.style.display='block'; canvas.style.height=H+'px';
        canvas.width=W; canvas.height=H;

        // ── Board ──────────────────────────────────────────────────────────
        var board=MAP.map(function(r){return r.slice();});
        var total=0;
        for(var rr=0;rr<MR;rr++) for(var cc=0;cc<MC;cc++)
          if(board[rr][cc]===0||board[rr][cc]===3) total++;

        // ── Pac-Man ────────────────────────────────────────────────────────
        var pac={x:PAC_START.x,y:PAC_START.y,dx:0,dy:0,ndx:-1,ndy:0,mouth:0,mDir:1,score:0,lives:3};

        // ── Ghosts — deep copy ─────────────────────────────────────────────
        var ghosts=GHOST_DEFS.map(function(d){
          return {x:d.x,y:d.y,dx:0,dy:0,color:d.color,name:d.name,
                  releaseAt:d.releaseAt,mode:d.mode,scared:false,st:0,
                  exitingHouse:false};
        });

        var PAC_RATE=18, GHOST_RATE=24;
        var frame=0, eaten=0, invTimer=0, scatterTimer=0;

        active=true;

        // ── Controls ───────────────────────────────────────────────────────
        kH=function(e){
          var map={'ArrowLeft':'L','a':'L','A':'L','ArrowRight':'R','d':'R','D':'R',
                   'ArrowUp':'U','w':'U','W':'U','ArrowDown':'D','s':'D','S':'D'};
          var dir=map[e.key];
          if(dir){
            e.preventDefault();
            if(dir==='L'){pac.ndx=-1;pac.ndy=0;} if(dir==='R'){pac.ndx=1;pac.ndy=0;}
            if(dir==='U'){pac.ndx=0;pac.ndy=-1;} if(dir==='D'){pac.ndx=0;pac.ndy=1;}
          }
          if(e.key==='Escape'){cleanup(ctx);}
        };
        document.addEventListener('keydown',kH);
        ctx.printLine('🎮 PAC-MAN — WASD / Arrows · ESC to quit','term-out-bold');

        // ── Helpers ────────────────────────────────────────────────────────
        function walkable(x,y,forGhost){
          if(y<0||y>=MR||x<0||x>=MC)return false;
          var c=board[y][x];
          if(c===1)return false;
          if(!forGhost&&c===4)return false;  // Pac can't enter ghost house
          if(!forGhost&&c===5)return false;
          return true;
        }
        function isInHouse(x,y){return board[y]&&(board[y][x]===5||board[y][x]===4);}

        function ghostTarget(g){
          if(g.scared) return null;
          if(scatterTimer>0){
            // Scatter corners
            if(g.name==='blinky') return {x:MC-2,y:0};
            if(g.name==='pinky')  return {x:1,y:0};
            if(g.name==='inky')   return {x:MC-2,y:MR-1};
            if(g.name==='clyde')  return {x:1,y:MR-1};
          }
          if(g.name==='blinky') return {x:pac.x,y:pac.y};
          if(g.name==='pinky'){
            return {x:Math.max(0,Math.min(MC-1,pac.x+pac.dx*4)),
                    y:Math.max(0,Math.min(MR-1,pac.y+pac.dy*4))};
          }
          if(g.name==='inky'){
            var blinky=ghosts[0];
            var ax=pac.x+pac.dx*2,ay=pac.y+pac.dy*2;
            return {x:Math.max(0,Math.min(MC-1,2*ax-blinky.x)),
                    y:Math.max(0,Math.min(MR-1,2*ay-blinky.y))};
          }
          if(g.name==='clyde'){
            var dist=Math.abs(g.x-pac.x)+Math.abs(g.y-pac.y);
            return dist>8?{x:pac.x,y:pac.y}:{x:1,y:MR-1};
          }
          return {x:pac.x,y:pac.y};
        }

        function respawn(){
          pac.x=PAC_START.x;pac.y=PAC_START.y;pac.dx=0;pac.dy=0;pac.ndx=-1;pac.ndy=0;
          invTimer=180;
          ghosts.forEach(function(g,i){
            var d=GHOST_DEFS[i];
            g.x=d.x;g.y=d.y;g.dx=0;g.dy=0;g.scared=false;g.st=0;
            g.mode=d.mode;g.exitingHouse=(d.name==='blinky');g.releaseAt=d.releaseAt;
          });
        }

        // ── Game loop ──────────────────────────────────────────────────────
        function loop(){
          if(!active)return;
          frame++; if(scatterTimer>0)scatterTimer--;

          var C=canvas.getContext('2d');
          var ac=ctx.getAccentColor(),ar=ac.r,ag=ac.g,ab=ac.b;
          var light=isLight();

          var BG    =light?'#f0f4fc':'#050a12';
          var WALL_A='rgba('+ar+','+ag+','+ab+',1)';
          var WALL_G='rgba('+ar+','+ag+','+ab+',.5)';
          var DOT_C ='rgba('+ar+','+ag+','+ab+',.7)';
          var HUD   ='rgba(255,255,255,.9)';
          var DOOR_C='rgba(255,180,255,.9)';

          C.fillStyle=BG; C.fillRect(0,0,W,H);
          // Subtle scanlines
          if(!light) for(var sy=0;sy<H;sy+=4){C.fillStyle='rgba(0,0,0,.07)';C.fillRect(0,sy,W,2);}

          // ── Draw maze ───────────────────────────────────────────────────
          for(var row=0;row<MR;row++) for(var col=0;col<MC;col++){
            var tx=col*CS,ty=row*CS,cell=board[row][col];
            if(cell===1){
              // Wall with glow outline
              C.fillStyle=WALL_A;
              C.shadowColor='rgba('+ar+','+ag+','+ab+',.6)';
              C.shadowBlur=CS*.5;
              C.fillRect(tx+1,ty+1,CS-2,CS-2);
              C.shadowBlur=0;
            } else if(cell===0){
              C.beginPath();C.arc(tx+CS/2,ty+CS/2,CS*.13,0,Math.PI*2);
              C.fillStyle=DOT_C;C.shadowColor='rgba('+ar+','+ag+','+ab+',.5)';C.shadowBlur=3;
              C.fill();C.shadowBlur=0;
            } else if(cell===3){
              var pulse=0.82+Math.sin(frame*.12)*.18;
              C.beginPath();C.arc(tx+CS/2,ty+CS/2,CS*.32*pulse,0,Math.PI*2);
              C.fillStyle='rgba(255,220,80,1)';C.shadowColor='rgba(255,200,50,.8)';C.shadowBlur=10;
              C.fill();C.shadowBlur=0;
            } else if(cell===4){
              // Ghost house door (pink bar)
              C.fillStyle=DOOR_C;
              C.fillRect(tx+2,ty+CS*.4,CS-4,CS*.25);
            }
            // cell===5 (house floor) and cell===2 (empty) = just BG
          }

          // ── Move Pac-Man ─────────────────────────────────────────────────
          if(frame%PAC_RATE===0){
            if(walkable(pac.x+pac.ndx,pac.y+pac.ndy,false)){pac.dx=pac.ndx;pac.dy=pac.ndy;}
            if(walkable(pac.x+pac.dx,pac.y+pac.dy,false)){
              pac.x+=pac.dx;pac.y+=pac.dy;
              // Tunnel wrap (rows 7)
              if(pac.x<0)pac.x=MC-1; if(pac.x>=MC)pac.x=0;
              var pickedCell=board[pac.y][pac.x];
              if(pickedCell===0||pickedCell===3){
                board[pac.y][pac.x]=2;eaten++;
                if(pickedCell===3){
                  pac.score+=50;scatterTimer=20;
                  ghosts.forEach(function(g){if(g.mode!=='house'){g.scared=true;g.st=240;}});
                } else {
                  pac.score+=10;
                }
                if(eaten%60===0){PAC_RATE=Math.max(12,PAC_RATE-1);GHOST_RATE=Math.max(16,GHOST_RATE-1);}
              }
            }
          }
          if(invTimer>0)invTimer--;

          // ── Move ghosts ──────────────────────────────────────────────────
          if(frame%GHOST_RATE===0){
            ghosts.forEach(function(g){
              // Release timer
              if(g.mode==='house'){
                if(frame>=g.releaseAt){g.mode='exiting';g.exitingHouse=true;}
                else return; // still waiting inside
              }
              // Exiting: move toward door then up
              if(g.mode==='exiting'){
                if(g.x!==DOOR_X){g.x+=(g.x<DOOR_X?1:-1);return;}
                if(g.y>DOOR_Y){g.y--;return;}
                g.mode='chase';g.exitingHouse=false;
              }

              // Scared timer
              if(g.st>0)g.st--;else g.scared=false;

              var dirs=[[1,0],[-1,0],[0,1],[0,-1]];
              var avail=dirs.filter(function(d){return walkable(g.x+d[0],g.y+d[1],true)&&!(d[0]===-g.dx&&d[1]===-g.dy);});
              if(!avail.length) avail=dirs.filter(function(d){return walkable(g.x+d[0],g.y+d[1],true);});
              if(!avail.length)return;

              var tgt=ghostTarget(g),best=null,bestD=g.scared?-Infinity:Infinity;
              avail.forEach(function(d){
                var nx=g.x+d[0],ny=g.y+d[1];
                var dist=tgt?Math.abs(nx-tgt.x)+Math.abs(ny-tgt.y):0;
                dist+=Math.random()*(g.scared?3:1.5);
                if(g.scared?dist>bestD:dist<bestD){bestD=dist;best=d;}
              });
              if(!best)best=avail[Math.floor(Math.random()*avail.length)];
              g.dx=best[0];g.dy=best[1];g.x+=g.dx;g.y+=g.dy;
              // Tunnel wrap
              if(g.x<0)g.x=MC-1; if(g.x>=MC)g.x=0;
            });

            // ── Collision ─────────────────────────────────────────────────
            if(invTimer===0){
              ghosts.forEach(function(g){
                if(g.mode==='house'||g.mode==='exiting')return;
                if(g.x===pac.x&&g.y===pac.y){
                  if(g.scared){
                    var d=GHOST_DEFS[ghosts.indexOf(g)];
                    g.x=d.x;g.y=d.y;g.scared=false;g.st=0;
                    g.mode='house';g.releaseAt=frame+90;
                    pac.score+=200;
                  } else {
                    pac.lives--;
                    if(pac.lives<=0){ctx.printLine('GAME OVER — Score: '+pac.score,'term-out-error');cleanup(ctx);return;}
                    respawn();
                  }
                }
              });
            }
          }

          if(eaten>=total){ctx.printLine('🎉 YOU WIN! Score: '+pac.score,'term-out-bold');cleanup(ctx);return;}

          // ── Draw Pac-Man ─────────────────────────────────────────────────
          var showPac=invTimer===0||Math.floor(frame/6)%2===0;
          if(showPac){
            pac.mouth+=.13*pac.mDir;if(pac.mouth>.24||pac.mouth<0)pac.mDir*=-1;
            var px=pac.x*CS+CS/2,py=pac.y*CS+CS/2,ang=Math.atan2(pac.dy||0,pac.dx||1);
            C.beginPath();C.moveTo(px,py);
            C.arc(px,py,CS*.44,ang+pac.mouth,ang+Math.PI*2-pac.mouth);
            C.closePath();
            C.fillStyle='rgba(255,230,0,1)';C.shadowColor='rgba(255,220,0,.8)';C.shadowBlur=CS*.5;
            C.fill();C.shadowBlur=0;
          }

          // ── Draw ghosts ──────────────────────────────────────────────────
          ghosts.forEach(function(g){
            if(g.mode==='house'&&!g.exitingHouse)return;
            var gx=g.x*CS+CS/2,gy2=g.y*CS+CS/2;
            var gc=g.scared
              ?(g.st<60&&Math.floor(frame/6)%2===0?'rgba(255,255,255,1)':'rgba(40,100,255,1)')
              :g.color;
            var glowC=g.scared?'rgba(100,150,255,.6)':g.color.replace('1)',',.5)').replace(',1)',', .5)');
            C.shadowColor=glowC; C.shadowBlur=CS*.6;
            C.beginPath();
            C.arc(gx,gy2,CS*.44,Math.PI,0);
            C.lineTo(gx+CS*.44,gy2+CS*.4);
            for(var wi=3;wi>=0;wi--)
              C.arc(gx+CS*.44-CS*.22*(3-wi+.5),gy2+CS*.4,CS*.11,0,Math.PI,wi%2===0);
            C.lineTo(gx-CS*.44,gy2);
            C.fillStyle=gc; C.fill(); C.shadowBlur=0;
            // Eyes
            if(!g.scared){
              C.fillStyle='white';
              [[gx-CS*.15,gy2-CS*.1],[gx+CS*.15,gy2-CS*.1]].forEach(function(p){
                C.beginPath();C.arc(p[0],p[1],CS*.13,0,Math.PI*2);C.fill();
              });
              C.fillStyle='#0033cc';
              var eyeDx=g.dx*.06*CS,eyeDy=g.dy*.06*CS;
              [[gx-CS*.15+eyeDx,gy2-CS*.08+eyeDy],[gx+CS*.15+eyeDx,gy2-CS*.08+eyeDy]].forEach(function(p){
                C.beginPath();C.arc(p[0],p[1],CS*.07,0,Math.PI*2);C.fill();
              });
            }
          });

          // ── HUD ──────────────────────────────────────────────────────────
          var fs=Math.max(11,Math.round(CS*.75));
          C.font='bold '+fs+'px monospace';C.fillStyle=HUD;
          C.shadowColor='rgba(255,255,255,.3)';C.shadowBlur=4;
          C.fillText('SCORE:'+pac.score,4,H-5);
          C.fillStyle='rgba(255,80,80,1)';
          C.fillText('♥'.repeat(pac.lives),W/2-fs*pac.lives*.5,H-5);
          C.fillStyle=HUD;
          C.fillText('ESC',W-fs*2.5,H-5);
          C.shadowBlur=0;

          ctx.gameLoop.set(requestAnimationFrame(loop));
        }
        loop();
      });
    }
  });
})();
