import test from 'node:test';
import assert from 'node:assert/strict';
import { createEffects, EFEITOS } from '../games/neon-slither/effects.js';
import { drawSnake } from '../games/neon-slither/skins.js';
import { SKINS, ARENA } from '../games/neon-slither/config.js';
import { createWorld, radiusOf, lengthOf } from '../games/neon-slither/model.js';

// Corpo reto deitado no eixo x, cabeça na origem, do jeito que o desenho o
// entrega às partículas.
const corpoReto = (extra = {}) => ({
  r: 14, L: 400, hx: 0, hy: 0, angle: 0, vel: ARENA.speed, tempo: 0, boost: true, fracao: 1,
  em: d => ({ x: -d, y: 0, tx: 1, ty: 0 }), aparece: () => true, ...extra
});
// Solta durante `segundos` em quadros de 1/60, com o relógio andando, e
// devolve o máximo de partículas vivas ao mesmo tempo.
function soltarPor(fx, skin, segundos, corpo = corpoReto(), chave = 1) {
  let maximo = 0;
  for (let t = 0; t < segundos; t += 1 / 60) {
    fx.emitir(chave, skin, { ...corpo, tempo: t }, 1 / 60);
    maximo = Math.max(maximo, fx.total);
    fx.atualizar(1 / 60);
  }
  return maximo;
}

// O pedido era uma partícula com a cara do nome de cada skin. Este teste
// garante que nenhuma skin fique sem efeito, nem a que entrar depois.
test('toda skin solta a partícula dela', () => {
  for (const skin of SKINS) {
    assert.ok(EFEITOS[skin.id]?.length, `${skin.name} não tem efeito`);
    assert.ok(soltarPor(createEffects(400), skin.id, 3) > 0, `${skin.name} não soltou nada em três segundos`);
  }
});

// Duas skins com o mesmo efeito seriam a mesma skin com outra cor.
test('nenhuma skin repete o efeito de outra', () => {
  const vistos = new Map();
  for (const skin of SKINS) {
    const assinatura = JSON.stringify(EFEITOS[skin.id]);
    assert.ok(!vistos.has(assinatura), `${skin.name} repete o efeito de ${vistos.get(assinatura)}`);
    vistos.set(assinatura, skin.name);
  }
  assert.equal(Object.keys(EFEITOS).length, SKINS.length, 'efeito para skin que não existe');
});

// O teto é o que segura o custo: a arena inteira divide um número fixo de
// partículas, por mais cobras grandes que apareçam.
test('as partículas nunca passam do teto', () => {
  const fx = createEffects(120);
  for (let t = 0; t < 4; t += 1 / 60) {
    for (let dono = 0; dono < 30; dono++) {
      fx.emitir(dono, SKINS[dono % SKINS.length].id, corpoReto({ L: 6000, r: 49, tempo: t }), 1 / 60);
    }
    fx.atualizar(1 / 60);
    assert.ok(fx.total <= fx.capacidade, `${fx.total} partículas num teto de ${fx.capacidade}`);
  }
  assert.ok(fx.total > 100, 'o teste precisa encher o vetor');
});

test('as partículas morrem e o vetor esvazia', () => {
  const fx = createEffects(300);
  for (const skin of SKINS) soltarPor(fx, skin.id, .5, corpoReto(), skin.id.length);
  assert.ok(fx.total > 0);
  for (let i = 0; i < 60 * 4; i++) fx.atualizar(1 / 60);
  assert.equal(fx.total, 0, 'partícula que não morre acumula até o teto e fica lá');
});

// Corpo maior à vista solta mais, até um limite: um gigante enche a tela de
// efeito sem tomar o teto inteiro para si.
test('a quantidade acompanha o corpo à vista, com limite', () => {
  const conta = (L, fracao) => {
    const fx = createEffects(5000);
    soltarPor(fx, 'brasa', .5, corpoReto({ L, fracao }));
    return fx.total;
  };
  const curto = conta(400, 1), longo = conta(1200, 1), metade = conta(1200, .5), gigante = conta(40000, 1);
  assert.ok(longo > curto * 2, `corpo três vezes maior soltou ${longo} contra ${curto}`);
  assert.ok(metade < longo * .7, `com metade do corpo fora da tela soltou ${metade} contra ${longo}`);
  assert.ok(gigante <= longo * 1.2, `o gigante soltou ${gigante}: o limite por cobra não segurou`);
});

// Só solta quem aparece: o desenho descarta a cobra fora da tela antes de
// medir o corpo, e ela não chega a pedir partícula.
test('cobra fora da tela não solta partícula', () => {
  const world = createWorld({ difficulty: 'easy', seed: 9 });
  world.started = true;
  const s = world.player;
  s.mass = 3000; s.skin = 'brasa'; s.invulnerable = 1e9;
  for (let i = 0; i < 240; i++) world.update(1 / 60, { angle: 0 });
  const pontos = Math.ceil(lengthOf(s) / ARENA.spacing) + 1;
  const soltar = bounds => {
    const fx = createEffects(300);
    for (let i = 0; i < 60; i++) {
      drawSnake(null, s, { radius: radiusOf(s), bounds, points: pontos, effects: fx, dt: 1 / 60, speed: ARENA.speed, emitOnly: true });
      fx.atualizar(1 / 60);
    }
    return fx.total;
  };
  const perto = { left: s.x - 300, right: s.x + 300, top: s.y - 300, bottom: s.y + 300 };
  const longe = { left: s.x + 9000, right: s.x + 9600, top: s.y + 9000, bottom: s.y + 9600 };
  assert.ok(soltar(perto) > 0, 'a cobra na tela precisa soltar');
  assert.equal(soltar(longe), 0, 'a cobra fora da tela soltou partícula');
});

// O pulsar solta o anel no pico do brilho, uma vez por pulso, e não a cada quadro.
test('o anel do pulsar sai uma vez por pulso', () => {
  const fx = createEffects(100);
  const periodo = 2 * Math.PI / 2.4;
  let anteriores = 0, aneis = 0;
  for (let t = 0; t < periodo * 3; t += 1 / 60) {
    fx.emitir(1, 'pulsar', corpoReto({ tempo: t }), 1 / 60);
    if (fx.total > anteriores) aneis += fx.total - anteriores;
    anteriores = fx.total;
    fx.atualizar(1 / 60);
    anteriores = fx.total;
  }
  assert.ok(aneis >= 2 && aneis <= 3, `${aneis} anéis em três pulsos`);
});
