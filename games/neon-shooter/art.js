// Fuselagens vetoriais originais. O renderer grava cada combinação em bitmap
// uma única vez; placas, luzes e sombras não custam geometria durante a partida.
const TAU = Math.PI * 2;
function plate(c, points, fill, edge = '#718b9f', width = .045) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fillStyle = fill; c.fill(); c.lineWidth = width; c.strokeStyle = edge; c.stroke();
}
function disk(c, x, y, r, fill, edge) {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = fill; c.fill();
  if (edge) { c.lineWidth = .04; c.strokeStyle = edge; c.stroke(); }
}
function seam(c, points, color, width = .045) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
function reactor(c, x, y, r, color) {
  disk(c, x, y, r * 1.6, '#081322', color);
  disk(c, x, y, r, color); disk(c, x - r * .2, y - r * .25, r * .42, '#f0fcff');
}
function mirrored(c, fn) { for (const side of [-1, 1]) { c.save(); c.scale(side, 1); fn(); c.restore(); } }
function finish(c, lit, silhouette) {
  if (!lit) return;
  c.globalAlpha = .7; plate(c, silhouette, '#ffffff', '#ffffff'); c.globalAlpha = 1;
}

export function paintPlayer(c, lit) {
  c.save(); c.scale(17, 17);
  const hull = [[0,-1.12],[.25,-.39],[.94,.3],[.91,.66],[.36,.45],[.24,.72],[-.24,.72],[-.36,.45],[-.91,.66],[-.94,.3],[-.25,-.39]];
  plate(c, hull, '#152a40', '#69bdcf', .06);
  mirrored(c, () => {
    plate(c, [[.22,-.34],[.85,.33],[.79,.48],[.34,.32]], '#4b697c', '#8fb6c7');
    plate(c, [[.26,.02],[.41,.33],[.34,.69],[.21,.67]], '#253d55', '#4e8099');
    plate(c, [[.74,.12],[.85,.21],[.83,.52],[.72,.48]], '#c4d8df', '#6c96a5');
    seam(c, [[.43,.15],[.68,.34],[.76,.34]], '#67f5ff', .07);
    seam(c, [[.28,.63],[.28,.76]], '#a4f8ff', .12);
  });
  plate(c, [[0,-1.08],[.22,-.31],[.15,.37],[0,.56],[-.15,.37],[-.22,-.31]], '#92b4c5', '#d3e8ef');
  plate(c, [[0,-.7],[.125,-.3],[.1,.04],[0,.16],[-.1,.04],[-.125,-.3]], '#072536', '#53efff');
  seam(c, [[-.06,-.29],[0,-.5],[.06,-.29]], '#b7ffff', .04);
  seam(c, [[0,.28],[0,.43]], '#ecfaff', .075);
  finish(c, lit, hull); c.restore();
}

export function paintEnemy(c, type, r, color, lit) {
  c.save(); c.scale(r, r);
  const metal = lit ? '#deeef5' : '#283446', shade = lit ? '#a9c6d6' : '#142030';
  const edge = lit ? '#ffffff' : '#667387';
  if (type === 'drone') {
    mirrored(c, () => {
      plate(c, [[.15,-.48],[.65,-.7],[.97,-.18],[.65,.49],[.36,.33]], metal, edge);
      plate(c, [[.46,-.42],[.66,-.51],[.8,-.17],[.58,.24]], shade, color);
      seam(c, [[.55,-.31],[.66,-.09],[.55,.11]], color, .09);
    });
    plate(c, [[0,-.65],[.33,-.27],[.25,.58],[0,.95],[-.25,.58],[-.33,-.27]], metal, edge);
    reactor(c, 0, .12, .16, color);
  } else if (type === 'dart' || type === 'hunter') {
    const hunter = type === 'hunter';
    mirrored(c, () => {
      plate(c, [[.12,-.51],[hunter ? .82 : .62,-.86],[.49,.04],[.12,.74]], metal, edge);
      seam(c, [[.43,-.53],[.27,.08]], color, .09);
      if (hunter) plate(c, [[.45,-.66],[.56,-1],[.28,-.77],[.2,-.41]], '#52536d', color);
    });
    plate(c, [[0,-.67],[.25,-.25],[.12,.63],[0,1.08],[-.12,.63],[-.25,-.25]], shade, color);
    reactor(c, 0, -.1, .12, color);
  } else if (type === 'weaver') {
    mirrored(c, () => {
      plate(c, [[.06,-.5],[.57,-.57],[1,-.12],[.83,.43],[.31,.06],[.08,.58]], metal, edge);
      plate(c, [[.45,-.38],[.83,-.11],[.73,.13],[.35,-.03]], '#3d5262', color);
      seam(c, [[.63,-.23],[.72,-.05]], color, .11);
    });
    plate(c, [[0,-.8],[.26,-.3],[.2,.51],[0,.98],[-.2,.51],[-.26,-.3]], shade, color);
    reactor(c, 0, -.12, .14, color);
  } else if (type === 'gunner' || type === 'tank') {
    const tank = type === 'tank';
    plate(c, [[-.47,-.87],[.47,-.87],[.92,-.35],[.86,.47],[.39,.79],[-.39,.79],[-.86,.47],[-.92,-.35]], metal, edge);
    mirrored(c, () => {
      plate(c, [[.48,-.6],[.73,-.33],[.67,.45],[.45,.6],[.32,.15]], '#495264', edge);
      for (let y = -.32; y < .25; y += .2) seam(c, [[.48,y],[.65,y + .05]], shade, .085);
      seam(c, [[.53,-.49],[.64,-.34]], color, .08);
      if (!tank) plate(c, [[.54,.19],[.75,.19],[.7,.94],[.55,.94]], shade, edge);
    });
    plate(c, [[0,-.52],[.34,-.22],[.26,.44],[0,.6],[-.26,.44],[-.34,-.22]], shade, color);
    reactor(c, 0, -.07, tank ? .23 : .15, color);
    if (tank) seam(c, [[-.18,.64],[.18,.64]], color, .1);
    else plate(c, [[-.1,.47],[.1,.47],[.1,1.03],[-.1,1.03]], '#77899a', color);
  } else if (type === 'splitter') {
    for (let i = 0; i < 3; i++) {
      c.save(); c.rotate(i * TAU / 3);
      plate(c, [[-.18,-.09],[-.49,-.57],[-.23,-.94],[.23,-.94],[.49,-.57],[.18,-.09]], metal, edge);
      plate(c, [[-.19,-.39],[-.22,-.69],[.22,-.69],[.19,-.39]], shade, color);
      seam(c, [[-.12,-.59],[.12,-.59]], color, .08); c.restore();
    }
    reactor(c, 0, 0, .19, color);
  } else {
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * TAU / 4);
      plate(c, [[.19,-.24],[.24,-.93],[.62,-.93],[.84,-.54],[.55,-.47],[.39,-.11]], metal, edge);
      seam(c, [[.4,-.77],[.58,-.77],[.67,-.59]], color, .07); c.restore();
    }
    disk(c, 0, 0, .49, shade, color); reactor(c, 0, 0, .21, color);
  }
  c.restore();
}

export function paintBoss(c, id, r, color, lit) {
  c.save(); c.scale(r, r);
  const metal = lit ? '#d5eaf4' : '#354359', shade = lit ? '#9dbbcf' : '#111e30';
  if (id === 'prisma') {
    for (let i = 0; i < 6; i++) {
      c.save(); c.rotate(i * TAU / 6);
      plate(c, [[-.24,-.51],[-.39,-.83],[0,-1.08],[.39,-.83],[.24,-.51]], metal, '#6a899f');
      plate(c, [[-.22,-.68],[0,-.96],[.22,-.68]], shade, color);
      seam(c, [[-.14,-.67],[.14,-.67]], color, .055); c.restore();
    }
    disk(c, 0, 0, .59, shade, '#7491a7');
    for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * TAU / 3); plate(c, [[0,-.51],[.32,.1],[0,-.04],[-.32,.1]], '#425a70', color); c.restore(); }
    reactor(c, 0, 0, .17, color);
  } else if (id === 'vespa') {
    mirrored(c, () => {
      plate(c, [[.17,-.62],[.67,-.91],[1.12,-.23],[.92,.36],[.47,.18],[.28,.66]], metal, '#9c8a6a');
      plate(c, [[.52,-.62],[.73,-.49],[.94,-.18],[.79,.05],[.48,-.11]], shade, color);
      for (let i = 0; i < 3; i++) seam(c, [[.53 + i * .08,-.43 + i * .08],[.62 + i * .08,-.29 + i * .08]], color, .06);
      plate(c, [[.47,.1],[.67,.16],[.56,.7],[.41,.68]], '#69757e', '#b6a184');
      reactor(c, .49, .56, .065, color);
    });
    plate(c, [[0,-.88],[.32,-.36],[.26,.54],[0,1.03],[-.26,.54],[-.32,-.36]], shade, color);
    plate(c, [[0,-.49],[.16,-.21],[.12,.12],[0,.26],[-.12,.12],[-.16,-.21]], color, '#ffefd0');
    seam(c, [[0,.4],[0,.71]], color, .09);
  } else {
    disk(c, 0, 0, 1.03, shade, '#7f7399');
    for (let i = 0; i < 8; i++) {
      c.save(); c.rotate(i * TAU / 8);
      plate(c, [[-.21,-.56],[-.31,-.86],[-.13,-1.02],[.24,-.95],[.28,-.68],[.1,-.51]], metal, '#6c6486');
      seam(c, [[-.14,-.82],[.12,-.81]], color, .06); c.restore();
    }
    disk(c, 0, 0, .53, '#070d19', color); disk(c, 0, 0, .4, '#201634', '#8b65bb');
    reactor(c, 0, 0, .2, color);
  }
  c.restore();
}
