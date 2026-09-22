import { FIGURE } from './config.js';

// Uma geometria para desenho, colisão e membros soltos. Coordenadas locais,
// relativas aos pés, evitam diferenças de escala entre o corpo e a hitbox.
export function anatomy(scale = 1, { arms = 'down', aimAngle = 0, walk = 0 } = {}) {
  const h = FIGURE.height * scale, limb = FIGURE.limbR * scale;
  const torso = FIGURE.torsoR * scale, headR = FIGURE.headR * scale;
  const swing = Math.sin(walk) * h * .06;
  const point = (x,y) => ({x:x*h,y:y*h});
  const hip = point(0,-.42), neck = point(0,-.79);
  const head = {x:0,y:neck.y-headR,r:headR};
  const shoulder = point(0,-.75);
  const pieces = [];
  for (const side of [-1,1]) {
    const leg = side<0 ? 'leftLeg' : 'rightLeg';
    const root = point(side*.032,-.42), knee = point(side*.058,-.22), foot = point(side*.08,-.025);
    knee.x += side*swing; foot.x += side*swing*.6;
    pieces.push({id:leg,name:'perna',root,points:[root,knee,foot],r:limb*1.06,tip:'boot'});
    const arm = side<0 ? 'leftArm' : 'rightArm';
    const origin = point(side*.038,-.74);
    let elbow = point(side*.115,-.58), hand = point(side*.145,-.42);
    if (arms==='up') { elbow=point(side*.13,-.82); hand=point(side*.2,-.92); }
    if (arms==='bow') {
      if (side>0) {
        hand={x:Math.cos(-aimAngle)*h*.3,y:-.72*h+Math.sin(-aimAngle)*h*.3};
        elbow={x:hand.x*.54,y:origin.y+(hand.y-origin.y)*.54};
      } else { elbow=point(-.16,-.63); hand=point(-.02,-.73); }
    }
    pieces.push({id:arm,name:'braço',root:origin,points:[origin,elbow,hand],r:limb*.92,tip:'hand'});
  }
  return {h,limb,torso,head,neck,hip,shoulder,pieces};
}

export function transformPoint(p, foot, angle = 0) {
  const c=Math.cos(angle), s=Math.sin(angle);
  return {x:foot.x+p.x*c-p.y*s,y:foot.y+p.x*s+p.y*c};
}

export const IMPACT = { minSpeed:20, gravity:570, bounce:.24 };

// Torso e quadril nunca se separam. O desprendimento não altera a pontuação
// nem permite continuar atirando no mesmo alvo: é a consequência do impacto.
export function detachPart(hit, body, foot, velocity, enabled = true) {
  const id=hit?.limb;
  if (!enabled || !id || Math.hypot(velocity.vx,velocity.vy)<IMPACT.minSpeed) return null;
  const geometry=body.geometry;
  const shape=id==='head' ? {id,name:'cabeça',root:geometry.neck,head:geometry.head,r:geometry.head.r}
    : geometry.pieces.find(p=>p.id===id);
  if (!shape) return null;
  const root=shape.root, origin=transformPoint(root,foot);
  const local=p=>({x:p.x-root.x,y:p.y-root.y});
  const points=shape.points?.map(local), head=shape.head ? {...local(shape.head),r:shape.head.r} : null;
  const radius=Math.max(shape.r,...(points || [head]).map(p=>Math.hypot(p.x,p.y)+shape.r));
  return {id,name:shape.name,x:origin.x,y:origin.y,vx:Math.min(125,Math.max(-125,velocity.vx*2.3)),
    vy:Math.min(-55,velocity.vy*1.3-95),angle:0,spin:(velocity.vx>=0 ? 1 : -1)*(id==='head' ? 5 : 3.6),
    points,head,r:shape.r,tip:shape.tip,scale:body.h/FIGURE.height,radius,age:0,settled:false,
    wound:{dx:root.x,dy:root.y}};
}

export function stepPart(part, dt, groundY, width) {
  if (!Number.isFinite(dt) || dt<=0 || part.settled) return;
  let remaining=Math.min(dt,.1);
  while(remaining>1e-8) {
    const step=Math.min(remaining,1/120); remaining-=step;
    part.age+=step; part.vy+=IMPACT.gravity*step;
    part.x+=part.vx*step; part.y+=part.vy*step; part.angle+=part.spin*step;
    part.vx*=Math.exp(-.45*step);
    const points=part.head ? [part.head] : part.points;
    const bottom=Math.max(...points.map(p=>p.x*Math.sin(part.angle)+p.y*Math.cos(part.angle)+part.r));
    if(part.y+bottom>=groundY) {
      part.y=groundY-bottom;
      if(Math.abs(part.vy)<30 || part.age>2) {part.vx=part.vy=part.spin=0;part.settled=true;}
      else {part.vy=-Math.abs(part.vy)*IMPACT.bounce;part.vx*=.58;part.spin*=.6;}
    }
    if(part.x<part.radius || part.x>width-part.radius) {
      part.x=Math.max(part.radius,Math.min(width-part.radius,part.x));part.vx*=-.35;
    }
  }
}
