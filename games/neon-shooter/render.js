// Cena 3D em Canvas: malhas iluminadas, profundidade e instrumentação de combate.
import { createCamera, project } from './mesh3d.js';
import { createScene } from './scene3d.js';
import { SHIP_MESH, enemyMesh } from './models.js';
import { bossMesh } from './capital-ships.js';
import { createSpaceBackground, SECTORS } from './space-background.js';
import { SPACE, PLAYER, POWERUPS } from './config.js';

const TAU = Math.PI * 2;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const ATTACK = { aimed:'SALVA MIRADA',fan:'BATERIA FRONTAL',ring:'ANEL DE PROJÉTEIS',
  spiral:'BATERIA ROTATIVA',curtain:'BARRAGEM',charge:'INVESTIDA',summon:'REFORÇOS INIMIGOS' };

export function createRenderer(viewport, debug) {
  const view=viewport.view,ctx=view.ctx,scene=createScene(),background=createSpaceBackground();
  const cam=createCamera({fov:SPACE.fov,near:SPACE.near,y:SPACE.camLift,z:-SPACE.camBack});
  const point=new Float64Array(4),tail=new Float64Array(4);
  const sparks=[];
  let clock=0,shake=0,shakeOn=true,effects=true,flash=0,hurt=0,faces=0;
  const stars=Array.from({length:70},()=>({x:(Math.random()-.5)*3200,y:(Math.random()-.5)*2000,z:Math.random()*3000}));
  function setOptions(o={}) {if(o.shake!==undefined)shakeOn=!!o.shake;if(o.effects!==undefined)effects=o.effects===true||o.effects==='full';}
  function reset(){sparks.length=0;clock=0;shake=flash=hurt=0;}
  function invalidate(){}
  function burst(x,y,z,color,n,speed){
    if(!effects)return;
    for(let i=0;i<n&&sparks.length<220;i++){
      const a=Math.random()*TAU,v=speed*(.3+Math.random()*.7),life=.3+Math.random()*.65;
      sparks.push({x,y,z,vx:Math.cos(a)*v,vy:Math.sin(a)*v,vz:(Math.random()-.5)*v,life,max:life,color});
    }
  }
  function event(e){
    const z=e.z??0;
    if(e.type==='kill'){burst(e.x,e.y,z,'#ffc38b',18,120);shake=Math.max(shake,2);}
    if(e.type==='hit'||e.type==='bossHit')burst(e.x,e.y,z,'#f5deb0',4,65);
    if(e.type==='reflect')burst(e.x,e.y,z,'#8fcddd',8,100);
    if(e.type==='playerHit'){hurt=1;shake=10;burst(e.x,e.y,z,'#ffad75',24,150);}
    if(e.type==='shieldBlock')burst(e.x,e.y,z,'#99d6e4',10,100);
    if(e.type==='bossDown'){flash=.3;shake=16;burst(e.x,e.y,z,'#ffd3a2',90,300);}
    if(e.type==='bossSlam')shake=12;
    if(e.type==='pickup')burst(e.x,e.y,z,e.color,12,100);
    if(e.type==='bomb'){flash=.22;burst(e.x,e.y,z,'#ffffff',50,300);}
    if(e.type==='gameOver'){flash=.3;shake=16;burst(e.x,e.y,z,'#ffb57a',60,200);}
  }
  function circle(x,y,r,color,alpha=1){
    ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.stroke();ctx.globalAlpha=1;
  }
  function glow(x,y,z,r,color,alpha=1){
    if(!project(cam,x,y,z,point,0))return;
    const size=Math.max(.6,r*point[3]);
    ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.arc(point[0],point[1],size,0,TAU);ctx.fill();
    ctx.fillStyle='#edf8ff';ctx.beginPath();ctx.arc(point[0],point[1],size*.4,0,TAU);ctx.fill();ctx.globalAlpha=1;
  }
  function tracer(s,friendly){
    if(!project(cam,s.x,s.y,s.z,point,0))return;
    const color=friendly?(s.crit?'#ffe0a0':'#a3e5f5'):'#ff9b73';
    const back=friendly?.034:.065;
    if(project(cam,s.x-s.vx*back,s.y-s.vy*back,s.z-s.vz*back,tail,0)){
      ctx.strokeStyle=color;ctx.lineWidth=clamp(s.r*point[3]*.6,1,3);
      ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(tail[0],tail[1]);ctx.lineTo(point[0],point[1]);ctx.stroke();
    }
    glow(s.x,s.y,s.z,s.r*(friendly?1.2:1.55),color);
  }
  function brackets(x,y,r,color){
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();
    const k=Math.min(8,r*.4);
    for(const sx of [-1,1])for(const sy of [-1,1]){
      ctx.moveTo(x+sx*(r-k),y+sy*r);ctx.lineTo(x+sx*r,y+sy*r);ctx.lineTo(x+sx*r,y+sy*(r-k));
    }
    ctx.stroke();
  }
  function text(message,x,y,color='#b3c6d5',size=10,align='left'){
    ctx.fillStyle=color;ctx.font=`500 ${size}px ui-monospace,monospace`;ctx.textAlign=align;ctx.fillText(message,x,y);ctx.textAlign='left';
  }
  function warningColumn(x,y,r,progress){
    if(!project(cam,x,y,0,point,0))return;
    const radius=Math.max(14,r*point[3]);
    ctx.fillStyle='rgba(255,145,93,.045)';ctx.beginPath();ctx.arc(point[0],point[1],radius,0,TAU);ctx.fill();
    ctx.lineWidth=1.5;ctx.setLineDash([5,6]);circle(point[0],point[1],radius,'#ffb38a',.7);ctx.setLineDash([]);
    circle(point[0],point[1],radius*(1-clamp(progress,0,1)*.7),'#ffb38a',.6);
  }
  function instruments(world,opts){
    const w=view.w,h=view.h,b=world.boss,p=world.player;
    const sector=Math.floor((world.wave-1)/5)%3;
    if(w>900)text(SECTORS[sector],w/2,25,'#8dabbf',9,'center');
    if(b){
      const bw=Math.min(320,w*.36),x=(w-bw)/2,y=65;
      ctx.fillStyle='#07131ed9';ctx.fillRect(x-10,y-17,bw+20,45);
      text(b.name.toUpperCase(),w/2,y-3,'#e3e6e8',11,'center');
      ctx.fillStyle='#344450';ctx.fillRect(x,y+6,bw,4);
      ctx.fillStyle=b.phase===2?'#ef9475':'#b9cbd4';ctx.fillRect(x,y+6,bw*clamp(b.hp/b.maxHp,0,1),4);
      text(`FASE ${b.phase+1}/3`,x,y+23,'#a6b8c4',8);
      text(`${Math.ceil(Math.max(0,b.hp)/b.maxHp*100)}%`,x+bw,y+23,'#a6b8c4',8,'right');
      if(b.telegraph>0)text(`${ATTACK[b.pattern?.kind]||'ATAQUE'} · ${b.telegraph.toFixed(1)}s`,w/2,116,'#ffbd92',11,'center');
      else if(b.charge?.stage==='dash')text('EVASÃO!',w/2,116,'#ffbd92',12,'center');
    } else if(world.stage==='warning')text('ALERTA · NAVE CAPITAL EM APROXIMAÇÃO',w/2,83,'#ffbd92',12,'center');
    else if(world.stage==='intro'||world.stage==='rest')text(world.stage==='rest'?'SETOR LIMPO · PREPARE-SE':`ONDA ${world.wave} · INTERCEPTAR HOSTIS`,w/2,77,'#c1d7df',11,'center');
    if(world.aim&&p.alive){
      const a=world.aim;
      if(project(cam,a.x,a.y,a.z,point,0)){
        const x=point[0],y=point[1],color=a.locked?'#cee9c0':'#9bb9c9';
        circle(x,y,9,color,.8);ctx.strokeStyle=color;ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(x-16,y);ctx.lineTo(x-11,y);ctx.moveTo(x+11,y);ctx.lineTo(x+16,y);
        ctx.moveTo(x,y-16);ctx.lineTo(x,y-11);ctx.moveTo(x,y+11);ctx.lineTo(x,y+16);ctx.stroke();
        if(a.locked){brackets(x,y,Math.max(16,a.r*point[3]+5),color);text('ALVO',x,y+30,color,8,'center');}
      }
    }
    // Nível e bônus ficam nas bordas; o centro permanece livre para mirar.
    ctx.fillStyle='#182c39';ctx.fillRect(0,h-3,w,3);ctx.fillStyle='#91bca3';ctx.fillRect(0,h-3,w*world.xp/world.xpNext,3);
    text(`NV ${world.level}${world.combo>1?` · COMBO ${world.combo}`:''}`,14,h-67,'#acc8bc',9);
    let row=0;
    for(const [id,seconds]of Object.entries(world.effects))if(seconds>0){
      const x=w-15,y=h-66-row*17;text(`${POWERUPS[id].name.toUpperCase()} ${Math.ceil(seconds)}s`,x,y,POWERUPS[id].color,9,'right');row++;
    }
    const joy=opts.joystick;
    if(joy?.active){ctx.lineWidth=1.5;circle(joy.x,joy.y,joy.radius,'#bcd8e6',.38);circle(joy.x+joy.kx,joy.y+joy.ky,17,'#d0eaf5',.8);}
  }
  function draw(world,opts={}){
    const dt=Math.min(opts.dt??0,.05),frozen=!!opts.frozen;
    if(!frozen){clock+=dt;shake=Math.max(0,shake-dt*35);}
    cam.x=0;cam.y=SPACE.camLift;cam.z=-SPACE.camBack;
    cam.cx=view.w/2+(shakeOn&&!frozen?(Math.random()-.5)*shake:0);
    cam.cy=view.h/2+(shakeOn&&!frozen?(Math.random()-.5)*shake:0);
    viewport.begin();
    background(ctx,view.w,view.h,Math.floor(((world?.wave||1)-1)/5)%3);
    // Paralaxe discreta; nada de paredes ou grade de túnel no espaço aberto.
    ctx.fillStyle='#d2e2ec';
    for(const s of stars){
      const z=((s.z-clock*100)%3000+3000)%3000+120;
      if(!project(cam,s.x,s.y,z,point,0))continue;
      const r=clamp(point[3]*1.1,.45,1.6);ctx.globalAlpha=clamp(point[3]*.35,.08,.65);ctx.fillRect(point[0],point[1],r,r);
    }
    ctx.globalAlpha=1;
    scene.begin();
    const p=world?.player,b=world?.boss;
    if(!world){
      scene.add(SHIP_MESH,{x:view.w*.24*SPACE.camBack/SPACE.fov,y:-15,z:150,scale:90,yaw:-.48,pitch:.25,roll:-.22},cam);
      faces=scene.flush(ctx);return;
    }
    for(const e of world.enemies){
      if(e.dead||e.z< -45)continue;
      scene.add(enemyMesh(e.type,e.flash>0?'#f4eddb':e.color),{x:e.x,y:e.y,z:e.z,scale:e.r,
        yaw:e.yaw||0,pitch:e.pitch||0,roll:e.roll||0},cam);
    }
    if(b)scene.add(bossMesh(b.def.id,b.phase,b.flash>0),{x:b.x,y:b.y,z:b.z,scale:b.r,yaw:b.yaw||0,pitch:-.08,roll:b.roll*.45||0},cam);
    const visible=p?.alive&&!(p.invuln>0&&Math.floor(clock*14)%2===0);
    if(visible)scene.add(SHIP_MESH,{x:p.x,y:p.y,z:p.z,scale:PLAYER.size*1.5,
      roll:-p.tilt*.55,pitch:p.pitch*.24,yaw:p.tilt*.12},cam);
    faces=scene.flush(ctx,{fog:true,fogStart:SPACE.fogStart,fogEnd:SPACE.fogEnd,fogFloor:.7});
    // Marcação discreta permite reconhecer um contato antes da aproximação.
    for(const e of world.enemies){
      if(e.dead||e.z<0||!project(cam,e.x,e.y,e.z,point,0))continue;
      if(e.z<1350&&e.z>200){ctx.globalAlpha=.48;brackets(point[0],point[1],Math.max(6,e.r*point[3]+3),'#d3937a');ctx.globalAlpha=1;}
      if(e.charge>0){
        const x=point[0],y=point[1];circle(x,y,Math.max(10,e.r*point[3]+6),'#ffd6a1',.8);
        if(e.type==='lancer'){warningColumn(e.x,e.y,e.def.beamR,1-e.charge/e.def.charge);text('FEIXE CARREGANDO',view.w/2,116,'#ffbd92',10,'center');}
      }
      if(e.beam>0){
        warningColumn(e.x,e.y,e.def.beamR,1);
        if(project(cam,e.x,e.y,e.z,point,0)&&project(cam,e.x,e.y,0,tail,0)){
          ctx.strokeStyle='#d0baff';ctx.lineWidth=Math.max(4,e.def.beamR*point[3]);ctx.globalAlpha=.4;
          ctx.beginPath();ctx.moveTo(point[0],point[1]);ctx.lineTo(tail[0],tail[1]);ctx.stroke();ctx.globalAlpha=1;
        }
      }
    }
    if(b?.telegraph>0){
      if(b.pattern?.kind==='charge')warningColumn(b.x,b.y,b.r*.8,1-b.telegraph/b.pattern.telegraph);
      if(project(cam,b.x,b.y,b.z-b.r*.5,point,0))circle(point[0],point[1],Math.max(12,b.r*point[3]*.35),'#ffc093',.8);
    }
    ctx.globalCompositeOperation='lighter';
    for(const s of world.shots)tracer(s,false);
    for(const s of world.bullets)tracer(s,!s.mirrored);
    if(visible){
      const throttle=.7+Math.hypot(p.vx||0,p.vy||0)/PLAYER.speed*.35;
      for(const side of [-1,1]){
        const x=p.x+side*6.7;
        glow(x,p.y,p.z-15,3.4*throttle,'#80cee8',.8);
        if(effects&&project(cam,x,p.y,p.z-14,point,0)&&project(cam,x,p.y,p.z-28*throttle,tail,0)){
          ctx.strokeStyle='#86d8f5';ctx.lineWidth=2;ctx.globalAlpha=.4;ctx.beginPath();ctx.moveTo(point[0],point[1]);ctx.lineTo(tail[0],tail[1]);ctx.stroke();ctx.globalAlpha=1;
        }
      }
    }
    for(let i=sparks.length-1;i>=0;i--){
      const s=sparks[i];
      if(!frozen){s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;s.life-=dt;}
      if(s.life<=0){sparks[i]=sparks[sparks.length-1];sparks.pop();continue;}
      glow(s.x,s.y,s.z,2.5,s.color,s.life/s.max);
    }
    ctx.globalCompositeOperation='source-over';
    for(const d of world.drops){
      if(!project(cam,d.x,d.y,d.z,point,0))continue;
      const x=point[0],y=point[1],r=Math.max(7,12*point[3]);
      brackets(x,y,r,POWERUPS[d.kind].color);text(POWERUPS[d.kind].name,x,y+r+12,POWERUPS[d.kind].color,9,'center');
    }
    if(p.alive&&world.effects.shield>0&&project(cam,p.x,p.y,p.z,point,0))circle(point[0],point[1],26*point[3],'#a4def1',.5);
    if(opts.hud)instruments(world,opts);
    if(flash>0){ctx.globalAlpha=flash;ctx.fillStyle='#f5cba0';ctx.fillRect(0,0,view.w,view.h);ctx.globalAlpha=1;if(!frozen)flash=Math.max(0,flash-dt);}
    if(hurt>0){ctx.strokeStyle=`rgba(255,110,70,${hurt*.7})`;ctx.lineWidth=8;ctx.strokeRect(4,4,view.w-8,view.h-8);if(!frozen)hurt=Math.max(0,hurt-dt*1.6);}
    if(debug?.active)text(`${faces} faces · ${world.enemies.length} contatos · ${Math.round(opts.stats?.fps||0)} FPS`,14,view.h-82,'#92a8b9',8);
    ctx.globalAlpha=1;ctx.lineWidth=1;
  }
  return {draw,event,reset,invalidate,setOptions};
}
