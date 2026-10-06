// Cenários decorativos: sem hitbox. Dois bitmaps no máximo durante a transição,
// resolução limitada e detalhes estáticos para manter o custo baixo no celular.
const TAU = Math.PI * 2;
export const SECTORS = [
  { name: 'Órbita de Nereida', sky: '#071624', glow: '#236386', mist: '#40709a' },
  { name: 'Cinturão de Âmbar', sky: '#1b121d', glow: '#684150', mist: '#805141' },
  { name: 'Estaleiro Eclipse', sky: '#11142a', glow: '#403b76', mist: '#484e88' }
];
const sectorAt = wave => Math.floor((Math.max(1, wave || 1) - 1) / 5) % SECTORS.length;
function ellipse(c, x, y, rx, ry, color) { c.beginPath(); c.ellipse(x, y, rx, ry, -.35, 0, TAU); c.fillStyle = color; c.fill(); }
function rock(c, x, y, r, rotation) {
  c.save(); c.translate(x, y); c.rotate(rotation);
  const points = [[-.8,-.4],[-.2,-.95],[.55,-.72],[1,-.12],[.63,.74],[-.25,.88],[-.85,.35]];
  c.beginPath(); points.forEach(([a,b], i) => i ? c.lineTo(a*r,b*r) : c.moveTo(a*r,b*r)); c.closePath();
  c.fillStyle = '#201f29'; c.fill(); c.strokeStyle = '#5e46504d'; c.lineWidth = 1; c.stroke();
  c.beginPath(); c.moveTo(-.8*r,-.4*r); c.lineTo(-.18*r,-.13*r); c.lineTo(.55*r,-.72*r); c.lineTo(-.2*r,-.95*r); c.closePath(); c.fillStyle = '#41333c'; c.fill();
  ellipse(c, .2*r, .2*r, .23*r, .17*r, '#151923'); c.restore();
}
function station(c, x, y, r) {
  c.save(); c.translate(x, y); c.rotate(-.42);
  c.strokeStyle = '#27364f'; c.lineWidth = r * .13; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
  c.strokeStyle = '#56718a55'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r * 1.07, 0, TAU); c.stroke();
  for (let i = 0; i < 8; i++) {
    c.save(); c.rotate(i * TAU / 8);
    c.fillStyle = '#24324b'; c.fillRect(-r * .045, -r, r * .09, r * .85);
    c.fillStyle = '#314159'; c.fillRect(-r * .15, -r * 1.06, r * .3, r * .17);
    c.fillStyle = '#7494b666'; c.fillRect(-r * .1, -r * 1.02, r * .2, 2); c.restore();
  }
  c.fillStyle = '#1c2940'; c.fillRect(-r * .2, -r * 1.6, r * .4, r * 3.2);
  c.strokeStyle = '#4b617c77'; c.lineWidth = 1; c.strokeRect(-r * .2, -r * 1.6, r * .4, r * 3.2);
  for (let j = -7; j <= 7; j++) {
    c.fillStyle = j % 3 ? '#415e7655' : '#6292a86b'; c.fillRect(-r * .13, j * r * .2, r * .26, r * .055);
  }
  c.restore();
}
function paint(c, w, h, id, low) {
  const palette = SECTORS[id];
  const sky = c.createLinearGradient(0, 0, w*.5, h); sky.addColorStop(0, palette.sky); sky.addColorStop(1, '#050914');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  const glow = c.createRadialGradient(w*.68, h*.18, 0, w*.68, h*.18, w*.9);
  glow.addColorStop(0, palette.glow + '66'); glow.addColorStop(1, palette.glow + '00'); c.fillStyle = glow; c.fillRect(0,0,w,h);
  if (!low) for (let i = 0; i < 9; i++) {
    const x = w * (.2 + Math.sin(i * 1.9) * .7), y = h * (.1 + i * .06);
    const mist = c.createRadialGradient(x,y,0,x,y,w*.5); mist.addColorStop(0,palette.mist+'0c'); mist.addColorStop(1,palette.mist+'00');
    c.fillStyle = mist; c.fillRect(0,0,w,h);
  }
  if (id === 0) {
    const x = w * .84, y = h * .21, r = Math.min(w * .45, h * .3);
    const halo = c.createRadialGradient(x,y,r*.9,x,y,r*1.14); halo.addColorStop(0,'#5dc3ea00'); halo.addColorStop(.5,'#5dc3ea36'); halo.addColorStop(1,'#5dc3ea00');
    c.fillStyle = halo; c.fillRect(x-r*1.15,y-r*1.15,r*2.3,r*2.3);
    c.save(); c.beginPath(); c.arc(x,y,r,0,TAU); c.clip();
    const planet = c.createRadialGradient(x-r*.45,y-r*.5,r*.1,x,y,r*1.25);
    planet.addColorStop(0,'#2c526a'); planet.addColorStop(.55,'#162f46'); planet.addColorStop(1,'#050e1b');
    c.fillStyle=planet; c.fillRect(x-r,y-r,r*2,r*2);
    for (let i=0;i<8;i++) ellipse(c,x+Math.sin(i*2)*r*.32,y-r+i*r*.27,r*.85,r*.04,'#7895a512');
    const shadow=c.createLinearGradient(x-r,y-r,x+r*.7,y+r); shadow.addColorStop(0,'#02091300'); shadow.addColorStop(.5,'#02091319'); shadow.addColorStop(1,'#020913ef');
    c.fillStyle=shadow;c.fillRect(x-r,y-r,r*2,r*2); c.restore();
    ellipse(c,w*.17,h*.13,10,10,'#293e50');
    if (!low) station(c, w*.05, h*.56, w*.1);
  } else if (id === 1) {
    // Rochas nas bordas: o centro conserva um fundo escuro e tranquilo.
    for (let i=0;i<(low?7:16);i++) {
      const side=i%2, x=side?w*(.92+Math.sin(i)*.07):w*(.03+Math.sin(i)*.07);
      rock(c,x,h*((i*.137)%1),w*(.025+(i%4)*.017),i*1.7);
    }
    ellipse(c,w*.87,h*.13,w*.16,w*.16,'#372b33');
    c.strokeStyle='#9c71642c';c.lineWidth=3;c.beginPath();c.ellipse(w*.87,h*.13,w*.26,w*.04,-.4,0,TAU);c.stroke();
  } else {
    station(c,w*.92,h*.26,Math.min(w*.35,h*.24));
    c.save();c.translate(w*.04,h*.76);c.rotate(-.42);
    for (const side of [-1,1]) {
      c.fillStyle='#17283d';c.fillRect(side*w*.075-w*.06,-h*.13,w*.12,h*.26);
      c.strokeStyle='#3c5a7155';c.lineWidth=1;
      for (let i=0;i<7;i++) {c.beginPath();c.moveTo(side*w*.075-w*.06,-h*.13+i*h*.043);c.lineTo(side*w*.075+w*.06,-h*.13+i*h*.043);c.stroke();}
    }
    c.fillStyle='#324052';c.fillRect(-4,-h*.16,8,h*.32);c.restore();
  }
  // Escurece a área de manobra para separar tiros e silhuetas do cenário.
  const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#04091500');shade.addColorStop(.55,'#04091533');shade.addColorStop(1,'#040915a6');
  c.fillStyle=shade;c.fillRect(0,0,w,h);
}
export function createScenery(view) {
  let current=null, previous=null, key='', transition=1, sector=-1;
  function draw(dt, wave, low) {
    const id=sectorAt(wave), nextKey=`${view.w}|${view.h}|${low}`;
    if (id!==sector || nextKey!==key) {
      previous=nextKey===key?current:null; transition=previous?0:1;
      const canvas=document.createElement('canvas'), scale=low?1:1.25;
      canvas.width=Math.ceil(view.w*scale);canvas.height=Math.ceil(view.h*scale);
      const c=canvas.getContext('2d');c.scale(scale,scale);paint(c,view.w,view.h,id,low);
      current=canvas;key=nextKey;sector=id;
    }
    transition=Math.min(1,transition+dt*.65);
    const c=view.ctx; c.drawImage(current,0,0,view.w,view.h);
    if (previous && transition<1) {c.globalAlpha=1-transition;c.drawImage(previous,0,0,view.w,view.h);c.globalAlpha=1;} else previous=null;
  }
  return { draw, reset() { current=previous=null;key='';sector=-1;transition=1; } };
}
