// Fundo gerado uma vez por setor/tamanho; nenhum gradiente planetário por quadro.
export const SECTORS = ['ÓRBITA DE NEREIDA', 'CINTURÃO DE ÂMBAR', 'ESTALEIRO ECLIPSE'];
export function createSpaceBackground() {
  let key = '', layer;
  return function draw(ctx, w, h, sector) {
    const next = `${w}|${h}|${sector}`;
    if (next !== key) {
      key = next;
      layer = document.createElement('canvas');
      layer.width = Math.ceil(w); layer.height = Math.ceil(h);
      const c = layer.getContext('2d');
      const palette = [['#192d44','#617e95','#a4c3d3'],['#332920','#95724d','#d7b27c'],['#252b40','#6e799e','#bcc9db']][sector];
      c.fillStyle = '#050a12'; c.fillRect(0,0,w,h);
      const haze = c.createRadialGradient(w*.64,h*.34,0,w*.64,h*.34,w*.7);
      haze.addColorStop(0,palette[0]); haze.addColorStop(1,'#050a12');
      c.fillStyle=haze;c.fillRect(0,0,w,h);
      let seed = 1729 + sector * 133;
      const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
      for(let i=0;i<240;i++) {
        const x=random()*w,y=random()*h,r=random()>.96?1.3:.65;
        c.globalAlpha=.15+random()*.55;c.fillStyle='#d7e4f1';c.fillRect(x,y,r,r);
      }
      c.globalAlpha=1;
      const x=w*.81,y=h*.22,r=h*.36;
      const atmosphere=c.createRadialGradient(x,y,r*.97,x,y,r*1.09);
      atmosphere.addColorStop(0,palette[1]+'88');atmosphere.addColorStop(1,palette[1]+'00');
      c.fillStyle=atmosphere;c.beginPath();c.arc(x,y,r*1.09,0,Math.PI*2);c.fill();
      c.save();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();
      const planet=c.createRadialGradient(x-r*.5,y-r*.45,0,x,y,r*1.3);
      planet.addColorStop(0,palette[2]);planet.addColorStop(.5,palette[1]);planet.addColorStop(1,'#0a1322');
      c.fillStyle=planet;c.fillRect(x-r,y-r,r*2,r*2);
      for(let i=0;i<150;i++) {
        c.globalAlpha=.025+random()*.055;c.fillStyle=i%3?'#e2d9c7':'#182b33';
        c.beginPath();c.ellipse(x+(random()-.5)*r*2,y+(random()-.5)*r*2,random()*r*.3+5,random()*r*.035+1,-.25,0,Math.PI*2);c.fill();
      }
      c.globalAlpha=1;
      const shade=c.createLinearGradient(x-r,y-r,x+r*.5,y+r*.3);
      shade.addColorStop(0,'#02071000');shade.addColorStop(.47,'#02071044');shade.addColorStop(.83,'#020710ee');shade.addColorStop(1,'#020710');
      c.fillStyle=shade;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
      // Destacamento distante: silhuetas discretas, sem parecer alvos ativos.
      c.fillStyle='#172535';
      for(let i=0;i<5;i++) {const sx=w*(.11+i*.06),sy=h*(.18+i*.025);c.beginPath();c.moveTo(sx,sy);c.lineTo(sx+18,sy+3);c.lineTo(sx+6,sy+6);c.lineTo(sx-11,sy+3);c.closePath();c.fill();}
    }
    ctx.drawImage(layer,0,0,w,h);
  };
}
