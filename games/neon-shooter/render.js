// Desenho do Neon Shooter em 3D por software. Recebe o mundo, projeta e pinta.
//
// A câmera fica atrás e um pouco acima da nave, olhando para a profundidade. O
// túnel de linhas que recua é o que dá referência de distância: sem ele, um
// alvo pequeno vindo de frente não tem contra o que ser medido, e o jogador não
// consegue julgar quando ele chega.

import { createCamera, project } from './mesh3d.js';
import { createScene } from './scene3d.js';
import { SHIP_MESH, enemyMesh } from './models.js';
import { SPACE, PLAYER } from './config.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createRenderer(viewport, debug) {
  const view = viewport.view;
  const ctx = view.ctx;
  const scene = createScene();
  const cam = createCamera({ fov: SPACE.fov, near: SPACE.near });
  const p4 = new Float64Array(4);
  // Partículas e avisos vivem no espaço: explosão de inimigo distante tem de
  // aparecer pequena e lá no fundo, não do tamanho de uma perto.
  const sparks = [], floats = [];
  let clock = 0, shake = 0, shakeOn = true, effects = true;
  let flash = 0, flashColor = '#ffffff', hurt = 0;
  let camShakeX = 0, camShakeY = 0;

  // Estrelas do fundo: pontos fixos em profundidade que rolam, dando a sensação
  // de avanço mesmo quando não há inimigo nenhum na tela.
  const estrelas = Array.from({ length: 90 }, () => ({
    x: (Math.random() - .5) * 2600, y: (Math.random() - .5) * 2000,
    z: Math.random() * SPACE.spawnZ * 1.6 + 120
  }));

  function setOptions(o = {}) {
    if (o.shake !== undefined) shakeOn = !!o.shake;
    if (o.effects !== undefined) effects = !!o.effects;
  }
  function reset() { sparks.length = 0; floats.length = 0; shake = 0; flash = 0; hurt = 0; }
  function invalidate() {}

  // --------------------------------------------------------------- efeitos
  function faisca(x, y, z, color, n, forca) {
    if (!effects) return;
    for (let i = 0; i < n && sparks.length < 260; i++) {
      const a = Math.random() * TAU, e = (Math.random() - .5) * 2;
      const v = forca * (.4 + Math.random() * .8);
      sparks.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: e * v,
                    life: .3 + Math.random() * .5, max: .8, color });
    }
  }

  function event(e) {
    switch (e.type) {
      case 'kill':
        faisca(e.x, e.y, e.z, e.color, 16, 170);
        shake = Math.max(shake, 3);
        break;
      case 'hit': faisca(e.x, e.y, e.z, e.color, 4, 90); break;
      case 'reflect': faisca(e.x, e.y, e.z, e.color, 8, 130); break;
      case 'playerHit':
        hurt = 1; shake = Math.max(shake, 11);
        faisca(e.x, e.y, e.z ?? 0, '#ff6a6a', 22, 210);
        break;
      case 'shieldBlock': faisca(e.x, e.y, 0, '#5fd5ff', 10, 140); break;
      case 'bossDown':
        flash = .5; flashColor = e.color; shake = Math.max(shake, 16);
        faisca(e.x, e.y, e.z ?? 0, e.color, 60, 320);
        break;
      case 'bossSlam': shake = Math.max(shake, 13); break;
      case 'pickup':
      case 'bomb':
        flash = e.type === 'bomb' ? .42 : .14; flashColor = e.color;
        faisca(e.x, e.y, e.z ?? 0, e.color, e.type === 'bomb' ? 44 : 12, 200);
        break;
      case 'levelUp': flash = .2; flashColor = '#9dff6a'; break;
      case 'gameOver': flash = .6; flashColor = '#ff5a5a'; shake = Math.max(shake, 20); break;
    }
  }

  // ---------------------------------------------------------------- túnel
  // Grade que recua: anéis em profundidade e trilhos ligando um ao outro. As
  // linhas são o único jeito barato de dar escala à distância num fundo vazio.
  function tunel(z0) {
    const passo = 260, quantos = 9, total = passo * quantos;
    // O corredor tem exatamente a largura do plano jogável, com uma folga para
    // a nave não encostar na linha. Assim ele deixa de ser enfeite e passa a
    // dizer onde é a parede: antes era quase o dobro, os anéis de perto caíam
    // fora da tela, e a nave parecia voar do lado de fora do túnel.
    const hw = SPACE.halfW(view.w) * 1.08, hh = SPACE.halfH * 1.08;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#2d6f93';
    // Os quatro cantos do corredor, para desenhar anel e trilho com a mesma
    // conta. Sem os trilhos ligando os anéis, a grade lê como retângulos
    // soltos um dentro do outro em vez de um corredor indo embora.
    const cantos = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    // Borda fixa no plano da nave. Os anéis rolam, então o mais próximo cai num
    // `z` qualquer e quase nunca coincide com ela — sem esta linha parada, a
    // nave encostada no limite aparecia do lado de fora do corredor.
    const borda = [];
    for (const [cx, cy] of cantos) {
      if (!project(cam, cx, cy, 0, p4, 0)) { borda.length = 0; break; }
      borda.push(p4[0], p4[1]);
    }
    if (borda.length) {
      ctx.globalAlpha = .4;
      ctx.beginPath();
      ctx.moveTo(borda[0], borda[1]);
      for (let k = 2; k < 8; k += 2) ctx.lineTo(borda[k], borda[k + 1]);
      ctx.closePath();
      ctx.stroke();
    }
    let anterior = borda.length ? borda : null;
    for (let i = 0; i < quantos; i++) {
      // Os anéis rolam com a nave: `z0` é o deslocamento acumulado, e o módulo
      // faz o anel que sai atrás reaparecer na frente sem salto.
      // O corredor começa no plano da nave, não atrás dele. Com os anéis
      // nascendo mais longe, eles se projetavam menores que a nave e ela
      // parecia voar do lado de fora — perspectiva certa, leitura errada.
      const z = ((i * passo - z0) % total + total) % total;
      const tela = [];
      let ok = true;
      for (const [cx, cy] of cantos) {
        if (!project(cam, cx, cy, z, p4, 0)) { ok = false; break; }
        tela.push(p4[0], p4[1]);
      }
      if (!ok) { anterior = null; continue; }
      const alfa = clamp(1 - z / total, 0, 1) * .34;
      if (alfa <= .01) { anterior = null; continue; }
      ctx.globalAlpha = alfa;
      ctx.beginPath();
      ctx.moveTo(tela[0], tela[1]);
      for (let k = 2; k < 8; k += 2) ctx.lineTo(tela[k], tela[k + 1]);
      ctx.closePath();
      ctx.stroke();
      if (anterior) {
        ctx.globalAlpha = alfa * .7;
        ctx.beginPath();
        for (let k = 0; k < 8; k += 2) {
          ctx.moveTo(anterior[k], anterior[k + 1]);
          ctx.lineTo(tela[k], tela[k + 1]);
        }
        ctx.stroke();
      }
      anterior = tela;
    }
    ctx.globalAlpha = 1;
  }

  function estrelado(z0) {
    ctx.fillStyle = '#9fd8ff';
    for (const s of estrelas) {
      let z = s.z - z0 % (SPACE.spawnZ * 1.6);
      if (z < 60) z += SPACE.spawnZ * 1.6;
      if (!project(cam, s.x, s.y, z, p4, 0)) continue;
      // Teto no tamanho: `k` cresce sem limite quando a estrela chega perto da
      // câmera, e sem o teto ela vira um quadrado cobrindo a tela.
      const r = clamp(p4[3] * 90, .6, 2.6);
      ctx.globalAlpha = clamp(p4[3] * 160, .06, .5);
      ctx.fillRect(p4[0] - r / 2, p4[1] - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
  }

  // Bola luminosa projetada: tiro, power-up e faísca usam a mesma rotina.
  function bola(x, y, z, raio, cor, alfa = 1) {
    if (!project(cam, x, y, z, p4, 0)) return;
    const r = raio * p4[3];
    if (r < .4) return;
    ctx.globalAlpha = alfa;
    ctx.fillStyle = cor;
    ctx.beginPath(); ctx.arc(p4[0], p4[1], r, 0, TAU); ctx.fill();
    // Miolo claro: o que faz o projétil ler como luz e não como disco pintado.
    ctx.globalAlpha = alfa * .8;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(p4[0], p4[1], r * .45, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- quadro
  function draw(world, opts = {}) {
    const dt = Math.min(opts.dt ?? 0, .05);
    const frozen = !!opts.frozen;
    if (!frozen) clock += dt;
    const p = world?.player;

    // Câmera atrás e acima, acompanhando de leve o desvio da nave: o mundo
    // inteiro inclina com você, que é o que vende o volume.
    if (p) {
      cam.x += (p.x * SPACE.camLook - cam.x) * Math.min(1, dt * 6);
      cam.y += (p.y * SPACE.camLook + SPACE.camLift - cam.y) * Math.min(1, dt * 6);
      cam.z = p.z - SPACE.camBack;
    }
    if (shake > 0 && shakeOn) {
      camShakeX = (Math.random() - .5) * shake;
      camShakeY = (Math.random() - .5) * shake;
      shake = Math.max(0, shake - dt * 42);
    } else { camShakeX = camShakeY = 0; }
    cam.cx = view.w / 2 + camShakeX;
    cam.cy = view.h * .58 + camShakeY;

    viewport.begin();
    ctx.fillStyle = '#050b16';
    ctx.fillRect(0, 0, view.w, view.h);
    const rolagem = clock * 220;
    estrelado(rolagem);
    tunel(rolagem);

    if (!world) { ctx.globalAlpha = 1; return; }

    // ---- cena sólida
    scene.begin();
    for (const e of world.enemies) {
      if (e.dead) continue;
      scene.add(enemyMesh(e.type, e.flash > 0 ? '#ffffff' : e.color), {
        x: e.x, y: e.y, z: e.z, scale: e.r,
        yaw: e.yaw || 0, pitch: e.pitch || 0, roll: e.roll || 0
      }, cam);
    }
    const b = world.boss;
    if (b && b.state !== 'dead') {
      scene.add(enemyMesh(b.def.shape || 'tank', b.flash > 0 ? '#ffffff' : b.def.color), {
        x: b.x, y: b.y, z: b.z, scale: b.r, yaw: b.yaw || 0, pitch: b.pitch || 0, roll: b.roll || 0
      }, cam);
    }
    if (p?.alive) {
      // A nave pisca quando está intocável: o anel some, mas o corpo avisa.
      const piscando = p.invuln > 0 && Math.floor(clock * 14) % 2 === 0;
      if (!piscando) {
        scene.add(SHIP_MESH, {
          x: p.x, y: p.y, z: p.z, scale: PLAYER.size * 1.5,
          roll: -(p.tilt || 0) * .7, pitch: (p.pitch || 0) * .35, yaw: (p.tilt || 0) * .18
        }, cam);
      }
    }
    scene.flush(ctx, { fog: true, fogStart: SPACE.fogStart, fogEnd: SPACE.fogEnd, fogFloor: SPACE.fogFloor });

    // ---- luzes: tiros, power-ups e faíscas, do mais longe para o mais perto
    ctx.globalCompositeOperation = 'lighter';
    for (const s of world.shots) bola(s.x, s.y, s.z, s.r * 2.1, s.color || '#ff7a7a');
    for (const t of world.bullets) bola(t.x, t.y, t.z, t.r * (t.crit ? 2.6 : 2), t.crit ? '#ffe45e' : '#7fe4ff');
    for (const d of world.drops) {
      const pulso = 1 + Math.sin(clock * 6 + d.t * 3) * .18;
      bola(d.x, d.y, d.z, 13 * pulso, POWER_COLOR[d.kind] || '#9dff6a');
    }
    // Feixe do Perfurador: coluna acesa que o jogador precisa deixar.
    for (const e of world.enemies) {
      if (!(e.beam > 0)) continue;
      for (let i = 0; i < 9; i++) bola(e.x, e.y, e.z - i * (e.z / 9), e.def.beamR * .5, e.color, .22);
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      if (!frozen) {
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
        s.life -= dt;
      }
      if (s.life <= 0) { sparks[i] = sparks[sparks.length - 1]; sparks.pop(); continue; }
      bola(s.x, s.y, s.z, 4 * (s.life / s.max) + 1, s.color, clamp(s.life / s.max, 0, 1));
    }
    ctx.globalCompositeOperation = 'source-over';

    // ---- avisos de tela
    if (flash > 0) {
      ctx.globalAlpha = Math.min(.55, flash);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.globalAlpha = 1;
      if (!frozen) flash = Math.max(0, flash - dt * 2.4);
    }
    if (hurt > 0) {
      // Vinheta vermelha na borda: conta que levou dano sem tapar o centro,
      // que é justamente onde o jogador precisa continuar vendo.
      const g = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * .3,
                                         view.w / 2, view.h / 2, view.h * .72);
      g.addColorStop(0, 'rgba(255,60,60,0)');
      g.addColorStop(1, `rgba(255,60,60,${(hurt * .5).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, view.w, view.h);
      if (!frozen) hurt = Math.max(0, hurt - dt * 1.6);
    }
    if (debug?.enabled) {
      ctx.fillStyle = '#9fe8ff';
      ctx.font = '12px system-ui';
      ctx.fillText(`faces ${scene.faces} | inimigos ${world.enemies.length} | z nave ${p?.z ?? 0}`, 10, 18);
    }
    ctx.globalAlpha = 1;
  }

  return { draw, event, reset, invalidate, setOptions };
}

const POWER_COLOR = {
  heal: '#6dff9e', shield: '#5fd5ff', rapid: '#ffe45e', double: '#ff9b3d',
  triple: '#ff7ab8', power: '#ff5a5a', pierce: '#a47bff', slow: '#7dff6a', bomb: '#ffffff'
};
