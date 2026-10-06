import { createMesh, box, merge, normalize } from './mesh3d.js';

// Cascos chanfrados com placas, pontes, radiadores, hangares e baterias.
// Cada peça é fechada: nenhuma asa desaparece ao inclinar a nave.
function hull(w, h, d, color) {
  const verts = [], faces = [];
  const section = [[-.7,-1],[.7,-1],[1,-.55],[1,.55],[.7,1],[-.7,1],[-1,.55],[-1,-.55]];
  for (const [z, scale] of [[-d/2,.55],[-d*.22,1],[d/2,.8]]) {
    for (const [x,y] of section) verts.push(x*w*.5*scale,y*h*.5,z);
  }
  faces.push({idx:[7,6,5,4,3,2,1,0],color});
  for (let row=0;row<2;row++) for (let i=0;i<8;i++) {
    const a=row*8+i,b=row*8+(i+1)%8;
    faces.push({idx:[a,b,b+8,a+8],color});
  }
  faces.push({idx:[16,17,18,19,20,21,22,23],color});
  return createMesh(verts,faces);
}

const cache = new Map();
export function bossMesh(id, phase = 0, flash = false) {
  const key = `${id}:${phase}:${flash}`;
  if (cache.has(key)) return cache.get(key);
  const armor = flash ? '#deeaf0' : '#7e929f', dark = '#2f4354', plate = '#a2b0b6';
  const light = phase === 2 ? '#ff845d' : id === 'vespa' ? '#ffc079' : id === 'eclipse' ? '#b9a2ed' : '#8cdae4';
  const parts = [];
  const add = (mesh,x=0,y=0,z=0,roll=0) => parts.push({mesh,x,y,z,roll});
  const panel = (w,h,d,c,x,y,z,glow=false) => add(box(w,h,d,c,{glow}),x,y,z);
  if (id === 'vespa') {
    add(hull(.8,.55,2.7,armor));
    for (const side of [-1,1]) {
      add(hull(.65,.48,1.85,armor),side*1.05,-.03,.12);
      add(hull(1.1,.15,.65,dark),side*.65,0,.35,side*.16);
      panel(.24,.22,1.1,plate,side*.96,-.04,-.9);
      panel(.18,.15,.06,light,side*.96,-.04,-1.48,true);
      panel(.34,.2,.07,light,side*1.05,0,1.07,true);
    }
  } else if (id === 'eclipse') {
    add(hull(1.25,.7,2.05,armor));
    for (const side of [-1,1]) {
      add(hull(.85,.55,2.5,armor),side*1.04,0,.05);
      panel(.65,.16,.85,dark,side*.66,-.16,-.25);
      panel(.48,.2,.05,'#08121e',side*1.04,0,-1.18);
      panel(.5,.05,.06,light,side*1.04,.14,-1.2,true);
      for (let i=0;i<3;i++) panel(.45,.07,.17,plate,side*1.04,.29,-.6+i*.55);
    }
    panel(.65,.42,.09,dark,0,-.04,-1.02);
    panel(.28,.24,.1,light,0,-.04,-1.08,true);
  } else {
    add(hull(1.15,.75,2.45,armor));
    for (const side of [-1,1]) {
      add(hull(.66,.57,1.85,armor),side*.92,-.08,.2);
      panel(.7,.22,.55,dark,side*.65,0,.4);
      panel(.22,.25,.85,plate,side*.9,.13,-.67);
      panel(.13,.13,.07,light,side*.9,.13,-1.13,true);
    }
  }
  // Ponte de comando, faixa de janelas, painéis de casco e radiadores.
  add(hull(.48,.35,.68,dark),0,.46,.4);
  panel(.4,.07,.04,light,0,.5,.04,true);
  for (const side of [-1,1]) {
    for (let i=0;i<4;i++) {
      panel(.19,.035,.22,i%2 ? armor : plate,side*.3,.385,-.62+i*.33);
      panel(.06,.18,.16,dark,side*.53,-.03,.05+i*.23);
    }
    panel(.18,.18,.12,dark,side*.33,.4,-.58);
    panel(.075,.075,.4,plate,side*.33,.43,-.77);
    panel(.19,.19,.05,light,side*.26,0,1.22,true);
    if (phase > 0) panel(.2,.035,.26,'#191d24',side*.29,.41,-.2);
  }
  const mesh = normalize(merge(parts));
  cache.set(key,mesh);
  return mesh;
}
