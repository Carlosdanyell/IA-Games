// Malhas das naves. Cada uma é montada uma vez, na carga do módulo, e depois só
// transformada: o custo por quadro é a projeção dos vértices, não a montagem.
//
// O que guia o desenho é a silhueta. Numa tela de celular, com a nave a algumas
// dezenas de pixels, o jogador não lê detalhe nenhum — ele lê contorno. Por
// isso cada inimigo tem uma forma que não se confunde com outra ao longe:
// cunha, disco, anel, cruz, bastão, aglomerado. Cor e brilho vêm depois.
//
// `glow` marca a face que não escurece com a luz. Motor, visor e núcleo
// precisam continuar acesos quando a nave vira de costas, senão o neon apaga no
// pior momento, que é quando o inimigo está manobrando.

import { createMesh, mirrorX, box, cone, merge, normalize, TAU } from './mesh3d.js';

// ------------------------------------------------------------ vocabulário
// Prisma achatado: a peça básica de asa, aleta e placa de casco.
function slab(w, h, d, color, opts) { return box(w, h, d, color, opts); }

// Anel de `sides` lados, com espessura. Serve de aro, turbina e escudo.
function ring(radius, thickness, depth, sides, color, opts = {}) {
  const verts = [];
  const faces = [];
  const ri = radius - thickness, z = depth / 2;
  for (let i = 0; i < sides; i++) {
    const a = i / sides * TAU, cx = Math.cos(a), sy = Math.sin(a);
    verts.push(cx * radius, sy * radius, -z, cx * radius, sy * radius, z,
               cx * ri, sy * ri, -z, cx * ri, sy * ri, z);
  }
  for (let i = 0; i < sides; i++) {
    const a = i * 4, b = ((i + 1) % sides) * 4;
    faces.push({ idx: [a, a + 1, b + 1, b], color, ...opts });        // face externa
    faces.push({ idx: [a + 2, b + 2, b + 3, a + 3], color, ...opts }); // face interna
    faces.push({ idx: [a, b, b + 2, a + 2], color, ...opts });         // tampa de trás
    faces.push({ idx: [a + 1, a + 3, b + 3, b + 1], color, ...opts }); // tampa da frente
  }
  return createMesh(verts, faces);
}

// Bipirâmide: dois cones costas com costas. Cristal, mina, núcleo.
function spindle(radius, length, sides, color, opts = {}) {
  const verts = [0, 0, length / 2, 0, 0, -length / 2];
  for (let i = 0; i < sides; i++) {
    const a = i / sides * TAU;
    verts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  }
  const faces = [];
  for (let i = 0; i < sides; i++) {
    const b = 2 + i, c = 2 + (i + 1) % sides;
    faces.push({ idx: [0, c, b], color, ...opts });
    faces.push({ idx: [1, b, c], color, ...opts });
  }
  return createMesh(verts, faces);
}

// ------------------------------------------------------------------ nave
// Interceptador de asa invertida: o nariz é uma cunha longa, as asas nascem
// atrás e avançam, e os dois motores ficam na traseira, acesos. A asa invertida
// é o que dá silhueta própria — a forma mais comum em jogo do gênero é a asa
// em delta, e de longe toda delta parece igual.
const CASCO = '#20425c', PLACA = '#2f6283', BORDA = '#7fe4ff', VISOR = '#8ff6ff', MOTOR = '#53d9ff';

export const SHIP = (() => {
  const meiaAsa = [
    .16, 0, -.5,   .9, -.04, -1.1,   1.12, -.04, -.62,   .26, 0, .1
  ];
  const asa = mirrorX(meiaAsa, [{ idx: [0, 1, 2, 3], color: PLACA }], {});
  const pontaMeia = [.9, -.04, -1.1, 1.12, -.04, -.62, 1.16, .16, -.78];
  const ponta = mirrorX(pontaMeia, [{ idx: [0, 1, 2], color: BORDA, glow: .55 }], {});
  return merge([
    { mesh: cone(.34, 2.1, 6, CASCO), z: -.6 },                       // nariz
    { mesh: slab(.62, .34, 1.5, CASCO), z: -.2 },                     // espinha
    { mesh: asa },
    { mesh: ponta },
    { mesh: spindle(.19, .72, 6, VISOR, { glow: .9 }), y: .2, z: .18 }, // cabine acesa
    { mesh: ring(.3, .1, .36, 8, MOTOR, { glow: 1 }), x: -.42, z: -.92 },
    { mesh: ring(.3, .1, .36, 8, MOTOR, { glow: 1 }), x: .42, z: -.92 },
    { mesh: slab(.16, .5, .5, PLACA), y: .3, z: -.85 }                // deriva
  ]);
})();
export const SHIP_MESH = normalize(SHIP);

// ------------------------------------------------------------- inimigos
// Cada entrada devolve a malha já na escala 1: o renderizador aplica o raio do
// inimigo como escala. A cor da espécie entra nas faces acesas, para o tipo ser
// reconhecível pela luz mesmo contra o fundo.
// Casco claro o bastante para a silhueta aparecer contra o fundo da arena, que
// é quase preto. As primeiras cores (#38506b e #1d2d42) sumiam: com o piso de
// sombra do renderizador e a névoa por cima, a face mal iluminada ficava
// indistinguível do vazio e o inimigo virava só o ponto aceso do núcleo.
const CARCACA = '#6d88a8', SOMBRA = '#44607f';

function porCor(cor) {
  return {
    // Comum: cunha larga de ombros caídos, o inimigo que ensina a forma base.
    drone: () => merge([
      { mesh: cone(.8, 1.3, 5, CARCACA), z: -.3, pitch: Math.PI },
      { mesh: slab(1.8, .2, .5, SOMBRA), z: -.2 },
      { mesh: spindle(.22, .5, 6, cor, { glow: 1 }), z: .1 }
    ]),
    // Rápido: agulha fina e comprida. Silhueta magra lê como velocidade.
    dart: () => merge([
      { mesh: cone(.34, 2.2, 4, CARCACA), z: -1, pitch: Math.PI },
      { mesh: slab(1.1, .12, .3, SOMBRA), z: -.7 },
      { mesh: spindle(.16, .4, 4, cor, { glow: 1 }), z: -.9 }
    ]),
    // Lateral: asas largas e corpo curto, feito para varrer de lado.
    weaver: () => merge([
      { mesh: slab(2.4, .16, .6, CARCACA) },
      { mesh: slab(.5, .5, 1.2, SOMBRA) },
      { mesh: spindle(.26, .6, 6, cor, { glow: 1 }), z: .2 },
      { mesh: slab(.3, .6, .3, cor, { glow: .7 }), x: -1.05 },
      { mesh: slab(.3, .6, .3, cor, { glow: .7 }), x: 1.05 }
    ]),
    // Dispara: bloco com cano à frente, para o jogador ver de onde vem o tiro.
    gunner: () => merge([
      { mesh: box(1.4, 1, 1.1, CARCACA) },
      { mesh: box(.34, .34, 1.3, SOMBRA), z: .9 },
      { mesh: spindle(.2, .4, 6, cor, { glow: 1 }), z: 1.5 },
      { mesh: slab(.3, 1.3, .4, SOMBRA), x: -.8 },
      { mesh: slab(.3, 1.3, .4, SOMBRA), x: .8 }
    ]),
    // Resistente: casco gordo e chanfrado, com placas acesas nas quinas.
    tank: () => merge([
      { mesh: box(1.7, 1.4, 1.7, CARCACA) },
      { mesh: cone(1.1, .9, 6, SOMBRA), z: .85 },
      { mesh: ring(1.05, .22, .5, 6, cor, { glow: .8 }), z: -.4 },
      { mesh: slab(2.1, .3, .4, SOMBRA), z: -.2 }
    ]),
    // Especial: cristal partível, que já parece prestes a se abrir.
    splitter: () => merge([
      { mesh: spindle(1, 2.2, 3, CARCACA) },
      { mesh: spindle(.5, 2.6, 3, cor, { glow: .85 }), roll: Math.PI / 3 }
    ]),
    // Especial: ponta de lança com aletas, lê como algo que vai avançar.
    hunter: () => merge([
      { mesh: cone(.5, 1.8, 3, CARCACA), z: -.7, pitch: Math.PI },
      { mesh: slab(.2, 1.4, .8, SOMBRA), z: -.9 },
      { mesh: slab(1.4, .2, .8, SOMBRA), z: -.9 },
      { mesh: spindle(.3, .7, 3, cor, { glow: 1 }), z: .45 }
    ]),
    // Especial: anel que gira, e o anel é a promessa do tiro em círculo.
    spinner: () => merge([
      { mesh: ring(1.25, .3, .45, 8, CARCACA) },
      { mesh: spindle(.45, 1.1, 6, cor, { glow: 1 }) },
      { mesh: slab(2.3, .14, .22, SOMBRA) },
      { mesh: slab(.14, 2.3, .22, SOMBRA) }
    ]),

    // ------------------------------------------------- nascidos do 3D
    // Mergulhador: asa em bumerangue, que já conta que ele vem em arco.
    diver: () => merge([
      { mesh: cone(.42, 1.6, 4, CARCACA), z: -.5, pitch: Math.PI },
      { mesh: slab(1, .14, .7, SOMBRA), x: -.7, roll: .5 },
      { mesh: slab(1, .14, .7, SOMBRA), x: .7, roll: -.5 },
      { mesh: spindle(.24, .55, 4, cor, { glow: 1 }), z: -.6 }
    ]),
    // Muralha: placa larga e rasa, a peça de uma barreira com brecha.
    wall: () => merge([
      { mesh: box(2.6, 1.5, .4, CARCACA) },
      { mesh: ring(.9, .18, .5, 4, cor, { glow: .9 }), roll: Math.PI / 4 },
      { mesh: slab(2.8, .22, .2, SOMBRA), y: .8 },
      { mesh: slab(2.8, .22, .2, SOMBRA), y: -.8 }
    ]),
    // Orbital: dois aros cruzados, que giram em volta de você.
    orbiter: () => merge([
      { mesh: ring(1.1, .22, .3, 8, CARCACA) },
      { mesh: ring(1.1, .22, .3, 8, SOMBRA), pitch: Math.PI / 2 },
      { mesh: spindle(.38, .9, 6, cor, { glow: 1 }) }
    ]),
    // Espelho: placa chanfrada e lisa de frente, que devolve o que recebe.
    mirror: () => merge([
      { mesh: cone(1.15, .55, 4, cor, { glow: .55 }), z: .4 },
      { mesh: cone(1.15, .9, 4, CARCACA), z: -.1, pitch: Math.PI },
      { mesh: ring(1.2, .16, .3, 4, cor, { glow: 1 }), z: .1 }
    ]),
    // Enxame: aglomerado irregular, para ler como "muitos" e não como "um".
    swarm: () => merge([
      { mesh: spindle(.42, .9, 4, CARCACA), x: -.5, y: .3 },
      { mesh: spindle(.42, .9, 4, CARCACA), x: .55, y: -.2, roll: .7 },
      { mesh: spindle(.42, .9, 4, CARCACA), y: -.6, z: .3, roll: -.5 },
      { mesh: spindle(.3, .7, 4, cor, { glow: 1 }), x: .1, y: .15 }
    ]),
    // Perfurador: bastão longo apontado para você, com o cano aceso.
    lancer: () => merge([
      { mesh: box(.7, .7, 2.6, CARCACA) },
      { mesh: cone(.3, 1.4, 6, SOMBRA), z: 1.3 },
      { mesh: ring(.75, .2, .4, 6, cor, { glow: .9 }), z: -.9 },
      { mesh: spindle(.2, .5, 6, cor, { glow: 1 }), z: 2.3 }
    ])
  };
}

// As malhas são cacheadas por tipo e cor: a mesma espécie com a mesma cor é uma
// malha só, compartilhada por todos os inimigos vivos daquele tipo.
const cache = new Map();
export function enemyMesh(type, color) {
  const key = `${type}|${color}`;
  let m = cache.get(key);
  if (!m) {
    const fabrica = porCor(color)[type];
    // Tipo desconhecido não pode derrubar o quadro: cai no comum.
    // Normalizada: o renderizador escala pelo raio de colisão, então malha e
    // hitbox precisam ter o mesmo tamanho.
    m = normalize((fabrica ?? porCor(color).drone)());
    cache.set(key, m);
  }
  return m;
}

export const ENEMY_SHAPES = Object.keys(porCor('#fff'));
