import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../games/neon-shooter/world.js';
import { makeEnemy, makeBoss } from '../games/neon-shooter/enemies.js';
import { SPACE, PLAYER, PATTERNS, flightBounds, logicalSize } from '../games/neon-shooter/config.js';
import { sweepSphere, aimTarget } from '../games/neon-shooter/combat.js';
import { createCamera, compose, transformPoint, project, cone, box } from '../games/neon-shooter/mesh3d.js';
import { SHIP_MESH } from '../games/neon-shooter/models.js';
import { bossMesh } from '../games/neon-shooter/capital-ships.js';
import { createScene } from '../games/neon-shooter/scene3d.js';
import { createRenderer } from '../games/neon-shooter/render.js';

const world = () => {
  const w = createWorld({ ...logicalSize(844/390), seed: 8 });
  w.stage = 'rest'; w.stageTimer = 999; w.queue.length = 0;
  return w;
};

test('arrasto grande não teletransporta e a nave estabiliza no destino', () => {
  const w=world(),p=w.player,x=p.x,y=p.y,dt=1/120;
  w.update(dt,{dx:150,dy:20});
  assert.ok(Math.hypot(p.x-x,p.y-y) <= PLAYER.speed*dt+1e-9);
  for(let i=0;i<120;i++)w.update(dt,{});
  assert.ok(Math.abs(p.x-150*SPACE.camBack/SPACE.fov)<.01);
  assert.ok(Math.abs(p.vx)<.02&&Math.abs(p.vy)<.02);
  assert.ok(Math.abs(p.tilt)<.01);
});

test('diagonal do teclado respeita a mesma velocidade e arrasto não depende do FPS', () => {
  const result=[];
  for(const hz of [60,120]){
    const w=world();
    w.update(1/hz,{dx:100,dy:0});
    for(let i=0;i<hz;i++)w.update(1/hz,{});
    result.push(w.player.x);
    for(let i=0;i<30;i++){
      const p=w.player,x=p.x,y=p.y;
      w.update(1/hz,{vx:-1,vy:-1});
      assert.ok(Math.hypot(p.x-x,p.y-y)<=PLAYER.speed/hz+1e-8);
    }
  }
  assert.ok(Math.abs(result[0]-result[1])<.05);
});

test('casco inteiro permanece visível nos quatro cantos de celulares horizontais', () => {
  const out=new Float64Array(4),v=new Float64Array(3);
  for(const aspect of [4/3,16/9,844/390,21/9]){
    const {w,h}=logicalSize(aspect),bounds=flightBounds(w,h);
    const cam=createCamera({x:0,y:SPACE.camLift,z:-SPACE.camBack,fov:SPACE.fov,near:SPACE.near});cam.cx=w/2;cam.cy=h/2;
    for(const x of [-bounds.halfW,bounds.halfW])for(const y of [bounds.minY,bounds.maxY])for(const roll of [-.55,.55]){
      const matrix=compose(new Float64Array(12),{x,y,scale:PLAYER.size*1.5,roll,pitch:.24,yaw:.12});
      for(let i=0;i<SHIP_MESH.verts.length;i+=3){
        transformPoint(matrix,...SHIP_MESH.verts.slice(i,i+3),v,0);
        assert.ok(project(cam,...v,out,0));
        assert.ok(out[0]>=0&&out[0]<=w&&out[1]>=0&&out[1]<=h,`${aspect}: ${out}`);
      }
    }
  }
});

test('redimensionar mantém o destino dentro do campo e não retoma movimento antigo', () => {
  const w=world();w.update(.1,{dx:10000});
  w.resize(660,460);
  assert.equal(w.player.targetX,w.player.x);assert.equal(w.player.targetY,w.player.y);
  assert.ok(Math.abs(w.player.x)<=w.halfW);
});

test('varredura detecta projétil rápido e preserva passagem fora do casco', () => {
  const target={x:0,y:0,z:50};
  assert.ok(Math.abs(sweepSphere(0,0,0,0,0,100,target,5)-.45)<1e-9);
  assert.equal(sweepSphere(8,0,0,8,0,100,target,5),Infinity);
  assert.equal(sweepSphere(0,0,50,0,0,50,target,5),0);
});

test('projétil acerta primeiro o alvo mais próximo, independente da ordem do array', () => {
  const w=world();
  const near=makeEnemy(w,'drone',0,0,60),far=makeEnemy(w,'drone',0,0,100);
  near.hp=far.hp=1;near.r=far.r=5;near.drop=far.drop=0;
  w.enemies=[far,near];
  w.bullets=[{x:0,y:0,z:0,vx:0,vy:0,vz:18000,r:2,damage:1,pierce:0}];
  w.update(1/120,{});
  assert.ok(near.dead);assert.ok(!far.dead);assert.equal(w.kills,1);
});

test('espelho só reflete quando a face da frente está voltada para a nave', () => {
  for(const yaw of [0,Math.PI]){
    const w=world(),e=makeEnemy(w,'mirror',0,0,60);e.yaw=yaw;w.enemies=[e];
    const shot={x:0,y:0,z:0,vx:0,vy:0,vz:8000,r:2,damage:1,pierce:0};w.bullets=[shot];
    const hp=e.hp;w.update(1/120,{});
    if(yaw===0){assert.ok(shot.mirrored);assert.equal(e.hp,hp);}
    else{assert.equal(e.hp,hp-1);assert.ok(!shot.mirrored);}
  }
});

test('assistência de mira só adquire alvos próximos da coluna de tiro', () => {
  const w=world(),e=makeEnemy(w,'drone',w.player.x+200,w.player.y,500);w.enemies=[e];
  assert.equal(aimTarget(w,PLAYER.aimAssist,PLAYER.bulletSpeed).locked,false);
  e.x=w.player.x+12;e.motionX=5000;
  const aim=aimTarget(w,PLAYER.aimAssist,PLAYER.bulletSpeed);
  assert.ok(aim.locked);assert.ok(aim.x-e.x<=36);
});

test('investida do chefe alcança o plano de colisão e permite evasão', () => {
  for(const dodge of [false,true]){
    const w=world(),p=w.player,b=makeBoss(w,1);
    p.x=p.targetX=0;p.y=p.targetY=0;
    b.x=b.y=0;b.z=b.homeZ;b.state='fight';b.rest=0;b.pattern=PATTERNS.charge;b.telegraph=PATTERNS.charge.telegraph;b.charge={stage:'aim'};
    w.boss=b;w.stage='boss';
    for(let i=0;i<180;i++)w.update(1/120,dodge?{vx:1,vy:1}:{});
    assert.equal(p.hp, dodge?PLAYER.maxHp:PLAYER.maxHp-2);
  }
});

test('normais laterais do cone apontam para fora', () => {
  const mesh=cone(1,2,8,'#ffffff');
  for(let i=0;i<8;i++){
    const face=mesh.faces[i];let x=0,y=0;
    for(const j of face.idx){x+=mesh.verts[j*3];y+=mesh.verts[j*3+1];}
    assert.ok(x*mesh.normals[i*3]+y*mesh.normals[i*3+1]>0);
  }
});

test('chefes possuem cascos distintos, normalizados e reutilizados entre quadros', () => {
  const meshes=['prisma','vespa','eclipse'].map(id=>bossMesh(id));
  for(const [i,id]of ['prisma','vespa','eclipse'].entries()){
    const mesh=meshes[i];assert.equal(mesh,bossMesh(id));assert.ok(Math.abs(mesh.radius-1)<1e-10);
    assert.ok(mesh.faces.length>100&&mesh.faces.length<500);
    assert.ok([...mesh.verts].every(Number.isFinite));
    assert.notEqual(mesh,bossMesh(id,2));
  }
  assert.notDeepEqual([...meshes[0].verts],[...meshes[1].verts]);
  assert.notDeepEqual([...meshes[1].verts],[...meshes[2].verts]);
});

function drawingContext(){
  const polygons=[];let polygon=[];
  const ctx=new Proxy({polygons,beginPath(){polygon=[];},moveTo(x,y){polygon.push([x,y]);},lineTo(x,y){polygon.push([x,y]);},fill(){polygons.push(polygon.slice());},
    createLinearGradient(){return{addColorStop(){}};},createRadialGradient(){return{addColorStop(){}};}},
    {get:(o,k)=>k in o?o[k]:(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),`${k}: ${args}`);},set:(o,k,v)=>(o[k]=v,true)});
  return ctx;
}

test('buffers da cena crescem sem perder vértices ou faces já acumulados', () => {
  const scene=createScene(),mesh=box(20,20,20,'#aabbcc'),cam=createCamera({fov:460});
  cam.cx=500;cam.cy=250;
  scene.begin();scene.add(mesh,{x:100,y:100,z:400},cam);
  const sample=drawingContext();const count=scene.flush(sample);
  scene.begin();for(let i=0;i<1200;i++)scene.add(mesh,{x:100,y:100,z:400},cam);
  const ctx=drawingContext();assert.equal(scene.flush(ctx),count*1200);
  for(const polygon of ctx.polygons)assert.ok(sample.polygons.some(p=>JSON.stringify(p)===JSON.stringify(polygon)));
});

test('render percorre menu, chefes, avisos, efeitos e joystick sem coordenadas inválidas', () => {
  const before=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>drawingContext()})};
  try{
    for(const aspect of [16/9,21/9]){
      const ctx=drawingContext(),view={...logicalSize(aspect),ctx};
      const render=createRenderer({view,begin(){}},{active:true});
      render.draw(null,{dt:1/60});
      const w=world();w.w=view.w;w.h=view.h;
      for(let id=0;id<3;id++)for(let phase=0;phase<3;phase++){
        const b=makeBoss(w,id);b.z=b.homeZ;b.state='fight';b.phase=phase;b.pattern=PATTERNS.charge;b.telegraph=.5;w.boss=b;
        w.aim=aimTarget(w,PLAYER.aimAssist,PLAYER.bulletSpeed);
        w.drops=[{x:0,y:0,z:400,kind:'heal'}];w.effects.shield=2;
        render.event({type:'bossDown',x:0,y:0,z:500});
        render.draw(w,{dt:1/60,hud:true,joystick:{active:true,x:100,y:300,radius:46,kx:10,ky:5}});
        render.setOptions({effects:'low',shake:false});render.draw(w,{dt:1/60,hud:true,frozen:true});
      }
    }
  }finally{globalThis.document=before;}
});

test('tipos tardios reaparecem nas formações, incluindo a Muralha após a onda de chefe', async () => {
  const { buildWave } = await import('../games/neon-shooter/enemies.js');
  const seen = new Set();
  for(let seed=1;seed<=40;seed++){
    const w=createWorld({...logicalSize(16/9),seed});
    for(const group of buildWave(w,16))for(const enemy of group.spawns)seen.add(enemy.type);
  }
  for(const type of ['diver','wall','orbiter','mirror','swarm','lancer'])assert.ok(seen.has(type),type);
});

test('centro do enxame se move na mesma velocidade com um ou quatro membros', async () => {
  const { updateEnemy } = await import('../games/neon-shooter/enemies.js');
  const positions=[];
  for(const count of [1,4]){
    const w=world(),group={x:-100,y:0};
    const enemies=Array.from({length:count},(_,slot)=>makeEnemy(w,'swarm',-100,0,500,{group,slot}));
    for(let i=0;i<120;i++){
      w.time+=1/120;for(const e of enemies)updateEnemy(w,e,1/120);
    }
    positions.push(group.x);
  }
  assert.ok(Math.abs(positions[0]-positions[1])<1e-9);
});
