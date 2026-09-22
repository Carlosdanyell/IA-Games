import { anatomy } from './anatomy.js';

const TAU=Math.PI*2;
const palettes={
  archer:{cloth:'#27485d',shade:'#142b3c',light:'#66889c',trim:'#6bf4dc',skin:'#dbb298',hair:'#172633'},
  target:{cloth:'#684450',shade:'#352f40',light:'#b97f7d',trim:'#ffc878',skin:'#e5b99a',hair:'#342b32'}
};
const circle=(c,x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();};
const line=(c,points,width,color)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();};

function head(c,p,r,colors,face='neutro',blink=false,facing=-1) {
  c.save();c.translate(p.x,p.y);
  const skin=c.createLinearGradient(-r,-r,r,r);skin.addColorStop(0,'#ffe0b8');skin.addColorStop(.5,colors.skin);skin.addColorStop(1,'#ae7a70');
  circle(c,0,0,r,skin);
  // Franja acompanha o círculo da cabeça: o desenho e a área de acerto coincidem.
  c.fillStyle=colors.hair;c.beginPath();c.arc(0,0,r,Math.PI,TAU);c.lineTo(r*.65,-r*.12);c.lineTo(r*.35,-r*.45);c.lineTo(-r*.3,-r*.18);c.lineTo(-r,-r*.02);c.closePath();c.fill();
  const fear=face==='medo',pain=face==='dor';
  c.lineCap='round';c.lineWidth=Math.max(.65,r*.12);
  for(const side of [-1,1]) {
    const x=side*r*.31+facing*r*.05,y=r*.09;
    if(pain) {
      line(c,[{x:x-r*.14,y:y-r*.12},{x:x+r*.14,y:y+r*.12}],r*.12,colors.hair);
      line(c,[{x:x+r*.14,y:y-r*.12},{x:x-r*.14,y:y+r*.12}],r*.12,colors.hair);
    } else if(blink || face==='alivio' || face==='mira' && side<0) line(c,[{x:x-r*.15,y},{x:x+r*.15,y:y-.3}],r*.1,colors.hair);
    else {circle(c,x,y,r*(fear?.23:.19),'#fff8ea');circle(c,x+facing*r*.05,y,r*.1,'#27333b');}
  }
  c.strokeStyle=colors.hair;c.fillStyle=colors.hair;c.beginPath();
  if(fear || pain) {c.ellipse(0,r*.48,r*.18,r*(pain?.25:.17),0,0,TAU);c.fill();}
  else {c.moveTo(-r*.18,r*.45);c.quadraticCurveTo(0,r*(face==='alivio'?.65:.5),r*.18,r*.45);c.stroke();}
  if(fear) {c.fillStyle='#89deff';c.beginPath();c.ellipse(-r*.76,r*.16,r*.1,r*.19,-.2,0,TAU);c.fill();}
  c.restore();
}

export function drawLimb(c,piece,{role='target',cut=false}={}) {
  const colors=palettes[role],r=piece.r;
  c.save();c.lineCap='round';c.lineJoin='round';
  if(piece.head) {head(c,piece.head,piece.head.r,colors,'dor');}
  else {
    line(c,piece.points,r*2,colors.shade);
    line(c,piece.points,r*1.65,colors.cloth);
    const [a,joint,tip]=piece.points;
    // Proteções de joelho/cotovelo, costura e punho.
    line(c,[a,{x:a.x+(joint.x-a.x)*.76,y:a.y+(joint.y-a.y)*.76}],r*.85,colors.light);
    circle(c,joint.x,joint.y,r*.9,colors.shade);circle(c,joint.x-.2,joint.y-.3,r*.43,colors.trim);
    const boot=piece.tip==='boot';
    line(c,[{x:joint.x+(tip.x-joint.x)*.6,y:joint.y+(tip.y-joint.y)*.6},tip],r*(boot?2.3:1.7),boot?'#152332':colors.skin);
    if(boot) line(c,[{x:tip.x-r*.5,y:tip.y},{x:tip.x+r*1.4,y:tip.y}],r*.8,'#627888');
  }
  if(cut) circle(c,0,0,r*.72,'#a93549');
  c.restore();
}

export function drawCharacter(c,{x,y,scale,lean=0,arms='down',aimAngle=0,walk=0,role='target',missing=null,face='neutro',blink=0,facing=-1,dark=true}) {
  const g=anatomy(scale,{arms,aimAngle,walk}),p=palettes[role],h=g.h;
  c.save();c.translate(x,y);c.rotate(lean);c.lineCap='round';c.lineJoin='round';
  for(const piece of g.pieces) if(piece.id!==missing) drawLimb(c,piece,{role});
  // Aljava rígida do arqueiro, atrás da jaqueta.
  if(role==='archer') {
    line(c,[{x:-h*.065,y:-h*.48},{x:-h*.105,y:-h*.78}],g.limb*2.2,'#101e2d');
    for(const off of [-2,0,2]) line(c,[{x:-h*.10+off*scale,y:-h*.73},{x:-h*.12+off*scale,y:-h*.9}],scale*.7,p.trim);
  }
  line(c,[g.neck,g.shoulder],g.limb*1.6,p.skin);
  const jacket=c.createLinearGradient(-g.torso,0,g.torso,0);jacket.addColorStop(0,p.shade);jacket.addColorStop(.4,p.cloth);jacket.addColorStop(1,p.light);
  line(c,[g.hip,g.shoulder],g.torso*2,jacket);
  line(c,[{x:0,y:-h*.7},{x:0,y:-h*.47}],scale*.75,p.trim);
  line(c,[{x:-g.torso*.9,y:-h*.68},{x:-g.torso*.6,y:-h*.57}],scale*1.6,p.trim);
  line(c,[{x:g.torso*.9,y:-h*.68},{x:g.torso*.6,y:-h*.57}],scale*1.6,p.trim);
  line(c,[{x:-g.torso*.92,y:-h*.445},{x:g.torso*.92,y:-h*.445}],scale*2.7,'#152533');
  c.fillStyle=p.trim;c.fillRect(-1.2*scale,-h*.445-1.5*scale,2.4*scale,3*scale);
  // Reflexo lateral, suficiente para distinguir a roupa do fundo.
  line(c,[{x:-g.torso*.72,y:-h*.72},{x:-g.torso*.7,y:-h*.5}],scale*.65,dark?'#bce3e988':'#26374688');
  if(missing!=='head') head(c,g.head,g.head.r,p,face,blink,facing);
  if(missing) {
    const root=missing==='head'?g.neck:g.pieces.find(s=>s.id===missing)?.root;
    if(root) circle(c,root.x,root.y,g.limb*.85,'#a93549');
  }
  c.restore();
}
