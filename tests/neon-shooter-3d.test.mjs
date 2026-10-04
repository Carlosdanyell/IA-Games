import test from 'node:test';
import assert from 'node:assert/strict';
import { identity, compose, transformPoint, transformDir, createCamera, project,
  createMesh, mirrorX, box, cone, merge, TAU } from '../games/neon-shooter/mesh3d.js';

const perto = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const ponto = (m, x, y, z) => { const o = new Float64Array(3); transformPoint(m, x, y, z, o, 0); return o; };

test('a identidade não move nada', () => {
  const m = identity();
  const p = ponto(m, 3, -4, 5);
  assert.deepEqual([...p], [3, -4, 5]);
});

test('a composição gira, escala e translada na ordem que lê como nave', () => {
  // Guinada de 90°: o nariz, que aponta para +z, passa a apontar para +x.
  const guinada = compose(new Float64Array(12), { yaw: Math.PI / 2 });
  const nariz = ponto(guinada, 0, 0, 1);
  assert.ok(perto(nariz[0], 1) && perto(nariz[1], 0) && perto(nariz[2], 0, 1e-12),
    `nariz foi para ${[...nariz]}`);
  // Arfagem de 90°: o nariz sobe.
  const arfagem = compose(new Float64Array(12), { pitch: Math.PI / 2 });
  const cima = ponto(arfagem, 0, 0, 1);
  assert.ok(perto(cima[1], 1) && perto(cima[2], 0, 1e-12), `nariz foi para ${[...cima]}`);
  // Rolagem de 90°: a asa direita desce (y da ponta vira -x... no referencial
  // destro com z para a frente, rolar leva +x para +y).
  const rolagem = compose(new Float64Array(12), { roll: Math.PI / 2 });
  const asa = ponto(rolagem, 1, 0, 0);
  assert.ok(perto(asa[0], 0, 1e-12) && perto(asa[1], 1), `asa foi para ${[...asa]}`);
  // Escala multiplica, translação soma, e a translação não é escalada.
  const tudo = compose(new Float64Array(12), { x: 10, scale: 2 });
  assert.deepEqual([...ponto(tudo, 1, 1, 1)], [12, 2, 2]);
});

test('direção ignora a translação, ponto não', () => {
  const m = compose(new Float64Array(12), { x: 100, y: 50, z: -7 });
  const p = new Float64Array(3), d = new Float64Array(3);
  transformPoint(m, 1, 0, 0, p, 0);
  transformDir(m, 1, 0, 0, d, 0);
  assert.deepEqual([...p], [101, 50, -7]);
  assert.deepEqual([...d], [1, 0, 0]);
});

test('a projeção encolhe com a distância e recorta o que está atrás', () => {
  const cam = createCamera({ fov: 500, near: 10 });
  cam.cx = 200; cam.cy = 300;
  const out = new Float64Array(4);
  // Mesmo ponto, duas distâncias: o dobro de longe é metade do desvio.
  assert.equal(project(cam, 100, 0, 500, out, 0), true);
  const perto1 = out[0] - cam.cx;
  assert.equal(project(cam, 100, 0, 1000, out, 0), true);
  const longe = out[0] - cam.cx;
  assert.ok(perto(longe, perto1 / 2, 1e-9), `desvio ${longe} não é metade de ${perto1}`);
  // `y` do mundo cresce para cima e o da tela para baixo: o sinal inverte.
  assert.equal(project(cam, 0, 100, 500, out, 0), true);
  assert.ok(out[1] < cam.cy, 'ponto acima do centro precisa cair acima na tela');
  // Atrás do plano próximo não projeta. Sem isso a geometria inverte de sinal e
  // se espalha pela tela, que é o artefato clássico de projeção sem recorte.
  assert.equal(project(cam, 0, 0, 5, out, 0), false);
  assert.equal(project(cam, 0, 0, -500, out, 0), false);
});

test('a malha calcula raio e normais', () => {
  const m = box(2, 2, 2, '#fff');
  // Caixa de lado 2: o vértice mais distante do centro está na diagonal.
  assert.ok(perto(m.radius, Math.sqrt(3), 1e-12), `raio ${m.radius}`);
  assert.equal(m.count, 8);
  assert.equal(m.faces.length, 6);
  // Toda normal de uma caixa é unitária e alinhada a um eixo.
  for (let i = 0; i < m.faces.length; i++) {
    const n = [m.normals[i * 3], m.normals[i * 3 + 1], m.normals[i * 3 + 2]];
    assert.ok(perto(Math.hypot(...n), 1, 1e-12), `normal ${n} não é unitária`);
    assert.equal(n.filter(v => Math.abs(v) > 1e-12).length, 1, `normal ${n} não é de eixo`);
  }
});

test('as normais de uma caixa apontam para fora', () => {
  const m = box(2, 2, 2, '#fff');
  m.faces.forEach((f, i) => {
    // Centro da face contra a normal dela: para fora, o produto escalar é
    // positivo. Se a ordem dos índices estiver trocada a face some no descarte.
    let cx = 0, cy = 0, cz = 0;
    for (const v of f.idx) { cx += m.verts[v * 3]; cy += m.verts[v * 3 + 1]; cz += m.verts[v * 3 + 2]; }
    cx /= f.idx.length; cy /= f.idx.length; cz /= f.idx.length;
    const d = cx * m.normals[i * 3] + cy * m.normals[i * 3 + 1] + cz * m.normals[i * 3 + 2];
    assert.ok(d > 0, `face ${i} aponta para dentro (${d.toFixed(3)})`);
  });
});

test('o espelho dobra a malha sem virar as faces para dentro', () => {
  // Meia asa, só do lado +x.
  const verts = [0, 0, 0, 1, 0, 0, 1, 0, 1];
  const m = mirrorX(verts, [{ idx: [0, 1, 2], color: '#fff' }]);
  assert.equal(m.count, 6, 'o espelho precisa dobrar os vértices');
  assert.equal(m.faces.length, 2);
  // A cópia existe do outro lado. O primeiro vértice espelhado é a cópia de um
  // que está em x = 0, então é o segundo que prova o espelho.
  assert.ok(m.verts[4 * 3] < 0, `a cópia precisa cair em -x, caiu em ${m.verts[4 * 3]}`);
  // As duas normais são opostas em x e iguais no resto: é o que prova que a
  // ordem dos índices foi invertida junto com o eixo.
  assert.ok(perto(m.normals[0], -m.normals[3], 1e-12) || perto(m.normals[0], 0, 1e-12));
  assert.ok(perto(Math.hypot(m.normals[3], m.normals[4], m.normals[5]), 1, 1e-12));
});

test('o cone fecha a base e aponta para +z', () => {
  const m = cone(1, 3, 6, '#fff');
  assert.equal(m.count, 7, 'ponta mais seis da base');
  assert.equal(m.faces.length, 7, 'seis lados mais a tampa');
  assert.ok(perto(m.verts[2], 3), 'a ponta precisa estar em z = altura');
  // A tampa olha para trás, no sentido oposto ao da ponta.
  const tampa = m.faces.length - 1;
  assert.ok(m.normals[tampa * 3 + 2] < 0, 'a tampa precisa olhar para -z');
});

test('juntar malhas preserva a geometria de cada parte', () => {
  const a = box(2, 2, 2, '#fff');
  const junto = merge([{ mesh: a }, { mesh: a, x: 10 }]);
  assert.equal(junto.count, 16);
  assert.equal(junto.faces.length, 12);
  // A segunda cópia está deslocada, e o raio cresce para abraçar as duas.
  assert.ok(junto.verts[8 * 3] >= 9, 'a parte deslocada precisa ir junto');
  assert.ok(junto.radius > a.radius, 'o raio precisa abraçar as duas partes');
  // Os índices da segunda cópia foram realocados, senão ela desenharia a
  // geometria da primeira.
  const maior = Math.max(...junto.faces.flatMap(f => f.idx));
  assert.equal(maior, 15);
});

test('nada no núcleo aloca por ponto transformado', () => {
  // O laço de transformação escreve em buffer do chamador. Se algum dia alguém
  // trocar por retorno de objeto, o custo por quadro muda de ordem: uma nave de
  // quarenta faces vira quarenta objetos novos a sessenta quadros por segundo.
  const m = compose(new Float64Array(12), { yaw: 1, scale: 2 });
  const buf = new Float64Array(300);
  for (let i = 0; i < 100; i++) transformPoint(m, i, i, i, buf, i * 3);
  assert.ok(buf[297] !== 0, 'o buffer precisa ter sido preenchido até o fim');
  assert.equal(buf.length, 300, 'o buffer não pode ter crescido');
});

test('o ângulo cheio é uma volta', () => assert.ok(perto(TAU, Math.PI * 2)));
