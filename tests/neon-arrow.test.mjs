import test from 'node:test';
import assert from 'node:assert/strict';
import { anatomy, detachPart, stepPart, transformPoint } from '../games/neon-arrow/anatomy.js';
import { bodyOf, firstHit, segmentCapsule } from '../games/neon-arrow/world.js';

const foot={x:300,y:240};
const body=scale=>bodyOf({scale}, {apple:1}, foot, {assist:1,apple:1});

test('cápsula detecta trajetória rápida, tangente, origem interna e ponto imóvel',()=>{
  const a={x:10,y:10},b={x:10,y:30};
  assert.equal(segmentCapsule(0,20,20,20,a,b,2),.4);
  assert.equal(segmentCapsule(0,8,20,8,a,b,2),.5);
  assert.equal(segmentCapsule(10,20,10,20,a,b,2),0);
  assert.equal(segmentCapsule(0,6,20,6,a,b,2),-1);
  assert.equal(segmentCapsule(0,10,20,10,a,a,2),.4);
});

test('acertos em braços, pernas e cabeça acompanham o desenho em todas as escalas',()=>{
  for(const scale of [.6,1,1.4]) {
    const b=body(scale),g=b.geometry;
    for(const id of ['leftArm','leftLeg']) {
      const shape=g.pieces.find(p=>p.id===id),p=transformPoint(shape.points[1],foot);
      const hit=firstHit(p.x-100,p.y,p.x,p.y,b);
      assert.equal(hit?.limb,id);
    }
    const p=transformPoint(g.head,foot);
    assert.equal(firstHit(p.x-50,p.y,p.x+50,p.y,b)?.limb,'head');
  }
});

test('maçã e corpo disputam o primeiro contato, sem premiar uma flecha que atingiu a cabeça antes',()=>{
  const b=body(1),a=b.apple,h=b.parts[0];
  assert.equal(firstHit(a.x-70,a.y,a.x+70,a.y,b)?.kind,'apple');
  assert.equal(firstHit(h.x,h.y,h.x,a.y-30,b)?.kind,'body');
  assert.equal(firstHit(a.x,a.y-30,h.x,h.y,b)?.kind,'apple');
  assert.equal(firstHit(foot.x,foot.y+8,foot.x+30,foot.y+8,b),null);
});

test('separação depende de velocidade, região e preferência',()=>{
  const b=body(1),hit={limb:'head'};
  assert.equal(detachPart(hit,b,foot,{vx:19,vy:0}),null);
  assert.equal(detachPart(hit,b,foot,{vx:32,vy:0},false),null);
  assert.equal(detachPart({part:'peito'},b,foot,{vx:32,vy:0}),null);
  assert.equal(detachPart({limb:'unknown'},b,foot,{vx:32,vy:0}),null);
  assert.equal(detachPart(hit,b,foot,{vx:20,vy:0}).id,'head');
});

test('peça desprendida começa exatamente onde estava no corpo e mantém sua escala',()=>{
  const b=body(1.3);
  for(const id of ['head',...b.geometry.pieces.map(p=>p.id)]) {
    const part=detachPart({limb:id},b,foot,{vx:30,vy:4});
    const points=part.head?[part.head]:part.points;
    const original=id==='head'?[b.geometry.head]:b.geometry.pieces.find(p=>p.id===id).points;
    points.forEach((p,i)=>{
      const result=transformPoint(p,part,0),expected=transformPoint(original[i],foot);
      assert.ok(Math.abs(result.x-expected.x)<1e-8);
      assert.ok(Math.abs(result.y-expected.y)<1e-8);
    });
  }
});

test('cabeça, braços e pernas caem e repousam sobre o chão dentro da tela',()=>{
  for(const id of ['head','leftArm','rightLeg']) {
    const part=detachPart({limb:id},body(1),foot,{vx:34,vy:-12});
    for(let i=0;i<720;i++)stepPart(part,1/120,240,380);
    assert.ok(part.settled,id);
    assert.ok(part.x>=part.radius && part.x<=380-part.radius);
    assert.ok(Number.isFinite(part.angle));
    const points=part.head?[part.head]:part.points;
    const bottom=Math.max(...points.map(p=>transformPoint(p,part,part.angle).y+part.r));
    assert.ok(Math.abs(bottom-240)<1e-7,`${id}: ${bottom}`);
  }
});

test('simulação de fragmentos é estável a 30 e 120 atualizações por segundo',()=>{
  const a=detachPart({limb:'leftLeg'},body(1),foot,{vx:26,vy:-5});
  const b=structuredClone(a);
  for(let i=0;i<30;i++)stepPart(a,1/30,240,640);
  for(let i=0;i<120;i++)stepPart(b,1/120,240,640);
  assert.ok(Math.abs(a.x-b.x)<1e-7);
  assert.ok(Math.abs(a.y-b.y)<1e-7);
  const before=structuredClone(a);stepPart(a,NaN,240,640);assert.deepEqual(a,before);
});
