// Núcleo 3D por software: matrizes, projeção e malhas. Não há dependência nem
// etapa de build no projeto, então WebGL e bibliotecas de cena estão fora; o
// que existe é o Canvas 2D do resto da biblioteca. A saída daqui são polígonos
// já projetados, que o renderizador preenche — é o desenho vetorial de arcade,
// que combina com a identidade neon e cabe no orçamento de quadro do celular.
//
// Convenção: destro, câmera na origem olhando para +z. `x` cresce para a
// direita, `y` para cima no mundo e para baixo na tela, invertido só na
// projeção. Nada aqui aloca por quadro: as contas escrevem em buffers que o
// chamador fornece.

export const TAU = Math.PI * 2;

// ---------------------------------------------------------------- matrizes
// Matriz 3x4 em ordem de linha: [m0..m3] é a primeira linha. A quarta linha é
// sempre [0,0,0,1] e não é guardada, porque só há rotação, escala e translação.
export function identity(out = new Float64Array(12)) {
  out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
  out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
  out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
  return out;
}

// Rotação na ordem Y (guinada), X (arfagem), Z (rolagem), depois escala e
// translação. A ordem importa e é a que lê como nave: a guinada aponta o nariz,
// a arfagem levanta, a rolagem inclina as asas.
//
// A arfagem usa a rotação destra invertida de propósito. Pela regra da mão
// direita, girar +90° em torno de +x leva o nariz (+z) para -y, ou seja,
// arfagem positiva abaixaria o nariz. Como todo chamador aqui é código de jogo
// querendo dizer "levanta", o sinal é trocado uma vez neste ponto em vez de ser
// negado em cada chamada.
export function compose(out, { x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0, scale = 1 }) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Ry * Rx(-arfagem) * Rz
  const m00 = cy * cr - sy * sp * sr, m01 = -cy * sr - sy * sp * cr, m02 = sy * cp;
  const m10 = cp * sr, m11 = cp * cr, m12 = sp;
  const m20 = -sy * cr - cy * sp * sr, m21 = sy * sr - cy * sp * cr, m22 = cy * cp;
  out[0] = m00 * scale; out[1] = m01 * scale; out[2] = m02 * scale; out[3] = x;
  out[4] = m10 * scale; out[5] = m11 * scale; out[6] = m12 * scale; out[7] = y;
  out[8] = m20 * scale; out[9] = m21 * scale; out[10] = m22 * scale; out[11] = z;
  return out;
}

// Aplica a matriz a um ponto, escrevendo em `out` no índice dado. Escrever em
// buffer em vez de devolver objeto é o que mantém o quadro sem alocação.
export function transformPoint(m, px, py, pz, out, at) {
  out[at] = m[0] * px + m[1] * py + m[2] * pz + m[3];
  out[at + 1] = m[4] * px + m[5] * py + m[6] * pz + m[7];
  out[at + 2] = m[8] * px + m[9] * py + m[10] * pz + m[11];
}

// Direção (normal) não leva translação.
export function transformDir(m, px, py, pz, out, at) {
  out[at] = m[0] * px + m[1] * py + m[2] * pz;
  out[at + 1] = m[4] * px + m[5] * py + m[6] * pz;
  out[at + 2] = m[8] * px + m[9] * py + m[10] * pz;
}

// ---------------------------------------------------------------- câmera
// A câmera fica parada atrás da nave olhando para +z, então a transformação de
// vista é uma subtração. Guardada como objeto para o renderizador poder
// sacudi-la (impacto, explosão) sem mexer na projeção.
export function createCamera({ x = 0, y = 0, z = 0, fov = 520, near = 12 } = {}) {
  return { x, y, z, fov, near, cx: 0, cy: 0 };
}

// Projeta um ponto do mundo. Devolve `false` quando o ponto está atrás do plano
// próximo: desenhar o que está atrás da câmera inverte o sinal e espalha a
// geometria pela tela, que é o artefato clássico de projeção sem recorte.
export function project(cam, wx, wy, wz, out, at) {
  const dz = wz - cam.z;
  if (dz < cam.near) return false;
  const k = cam.fov / dz;
  out[at] = cam.cx + (wx - cam.x) * k;
  out[at + 1] = cam.cy - (wy - cam.y) * k;
  out[at + 2] = dz;
  out[at + 3] = k;
  return true;
}

// ---------------------------------------------------------------- malhas
// Uma malha é um conjunto de vértices e faces. A face guarda os índices, a cor
// e um brilho próprio: a parte que acende (motor, cabine, visor) não escurece
// com a luz, senão o neon apaga quando a nave vira.
//
// `verts` é plano (x,y,z,x,y,z,...) para o laço de transformação não passar por
// objeto nenhum. `faces` é um array de { idx, color, glow, edge }.
export function createMesh(verts, faces, { edge = null } = {}) {
  const v = verts instanceof Float64Array ? verts : Float64Array.from(verts);
  const count = v.length / 3;
  let radius = 0;
  for (let i = 0; i < v.length; i += 3) {
    const d = Math.hypot(v[i], v[i + 1], v[i + 2]);
    if (d > radius) radius = d;
  }
  const normals = new Float64Array(faces.length * 3);
  faces.forEach((f, i) => {
    // Normal da face pelo produto vetorial dos dois primeiros lados. Serve
    // tanto para a luz quanto para descartar a face virada para o outro lado.
    const [a, b, c] = f.idx;
    const ax = v[b * 3] - v[a * 3], ay = v[b * 3 + 1] - v[a * 3 + 1], az = v[b * 3 + 2] - v[a * 3 + 2];
    const bx = v[c * 3] - v[a * 3], by = v[c * 3 + 1] - v[a * 3 + 1], bz = v[c * 3 + 2] - v[a * 3 + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    normals[i * 3] = nx / len; normals[i * 3 + 1] = ny / len; normals[i * 3 + 2] = nz / len;
  });
  return { verts: v, count, faces, normals, radius, edge };
}

// Espelha a malha no eixo x e devolve as duas metades juntas. Casco de nave é
// simétrico, e descrever só um lado corta pela metade o que é escrito à mão —
// e garante que os dois lados nunca saiam diferentes por erro de digitação.
export function mirrorX(verts, faces, options) {
  const base = Array.from(verts);
  const n = base.length / 3;
  const out = base.slice();
  for (let i = 0; i < base.length; i += 3) out.push(-base[i], base[i + 1], base[i + 2]);
  const all = faces.slice();
  for (const f of faces) {
    // A ordem dos índices inverte junto com o eixo, senão a normal da cópia
    // aponta para dentro e a face espelhada some no descarte.
    all.push({ ...f, idx: f.idx.map(i => i + n).reverse() });
  }
  return createMesh(out, all, options);
}

// ------------------------------------------------------------- primitivas
// Sólidos simples para compor cascos sem escrever vértice a vértice.
export function box(w, h, d, color, opts = {}) {
  const x = w / 2, y = h / 2, z = d / 2;
  const verts = [
    -x, -y, -z, x, -y, -z, x, y, -z, -x, y, -z,
    -x, -y, z, x, -y, z, x, y, z, -x, y, z
  ];
  const faces = [
    { idx: [0, 3, 2, 1] }, { idx: [4, 5, 6, 7] },
    { idx: [0, 1, 5, 4] }, { idx: [2, 3, 7, 6] },
    { idx: [1, 2, 6, 5] }, { idx: [0, 4, 7, 3] }
  ].map(f => ({ ...f, color, ...opts }));
  return createMesh(verts, faces);
}

// Pirâmide com base de `sides` lados: nariz de nave, ogiva, espinho.
export function cone(radius, height, sides, color, opts = {}) {
  const verts = [0, 0, height];
  for (let i = 0; i < sides; i++) {
    const a = i / sides * TAU;
    verts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  }
  const faces = [];
  for (let i = 0; i < sides; i++) {
    const b = 1 + i, c = 1 + (i + 1) % sides;
    faces.push({ idx: [0, b, c], color, ...opts });
  }
  const base = [];
  for (let i = sides; i >= 1; i--) base.push(i);
  faces.push({ idx: base, color, ...opts });
  return createMesh(verts, faces);
}

// Reescala a malha para o vértice mais distante cair no raio 1. O renderizador
// escala pelo raio de colisão do inimigo, então sem isso a malha apareceria com
// tamanho diferente da área que de fato machuca — uma malha de raio 3 desenhada
// sobre uma hitbox de raio 1 é tiro que passa por dentro do desenho.
export function normalize(mesh) {
  if (!mesh.radius) return mesh;
  const k = 1 / mesh.radius;
  const verts = new Float64Array(mesh.verts.length);
  for (let i = 0; i < verts.length; i++) verts[i] = mesh.verts[i] * k;
  return createMesh(verts, mesh.faces, { edge: mesh.edge });
}

// Junta malhas já posicionadas numa só, para o renderizador tratar uma nave
// inteira como um lote de faces e ordenar tudo de uma vez.
export function merge(parts) {
  const verts = [];
  const faces = [];
  for (const { mesh, x = 0, y = 0, z = 0, scale = 1, yaw = 0, pitch = 0, roll = 0 } of parts) {
    const base = verts.length / 3;
    const m = compose(new Float64Array(12), { x, y, z, yaw, pitch, roll, scale });
    const tmp = new Float64Array(3);
    for (let i = 0; i < mesh.verts.length; i += 3) {
      transformPoint(m, mesh.verts[i], mesh.verts[i + 1], mesh.verts[i + 2], tmp, 0);
      verts.push(tmp[0], tmp[1], tmp[2]);
    }
    for (const f of mesh.faces) faces.push({ ...f, idx: f.idx.map(i => i + base) });
  }
  return createMesh(verts, faces);
}

