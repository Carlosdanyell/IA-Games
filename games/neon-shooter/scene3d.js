// Rasterizador de cena por software sobre o Canvas 2D. Recebe objetos com malha
// e pose, devolve polígonos pintados com profundidade correta.
//
// Algoritmo do pintor: ordena as faces de trás para a frente e pinta na ordem.
// Não é z-buffer — duas faces que se cruzam saem erradas — mas naves são
// sólidos convexos que raramente se interpenetram, e o custo é uma ordenação
// por quadro em vez de um teste por pixel. Para malha de poucas dezenas de
// faces num celular, é a escolha certa.
//
// Nada aqui aloca por quadro depois do primeiro: os buffers crescem até o maior
// quadro já visto e são reaproveitados.

import { compose, transformPoint, transformDir, project } from './mesh3d.js';

// Luz fixa vindo de cima, da frente e da esquerda. Fixa no mundo, não na
// câmera: é o que faz a nave mudar de brilho ao inclinar, que é o sinal de
// volume mais barato que existe.
const LUZ = (() => {
  const v = [-.42, .78, -.46];
  const k = 1 / Math.hypot(...v);
  return [v[0] * k, v[1] * k, v[2] * k];
})();

// Mistura uma cor com preto (sombra) ou branco (realce) em sRGB, que é como o
// canvas compõe. Cacheada: a mesma cor e o mesmo degrau aparecem em dezenas de
// faces por quadro, e `parseInt` por face custa mais que a conta.
const tons = new Map();
const DEGRAUS = 16;
function tom(cor, luz) {
  const passo = Math.max(0, Math.min(DEGRAUS - 1, Math.round(luz * (DEGRAUS - 1))));
  const chave = cor + passo;
  let out = tons.get(chave);
  if (out) return out;
  const t = passo / (DEGRAUS - 1);
  // Piso de 0,42: face virada para longe da luz escurece, mas não some. Com
  // piso baixo e fundo quase preto, o lado sombreado apagava junto com o fundo
  // e a nave perdia metade da silhueta.
  const k = .42 + t * .58;
  const r = parseInt(cor.slice(1, 3), 16), g = parseInt(cor.slice(3, 5), 16), b = parseInt(cor.slice(5, 7), 16);
  out = `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
  tons.set(chave, out);
  return out;
}

export function createScene() {
  // Vértices projetados do quadro: x, y, profundidade, escala, por vértice.
  let proj = new Float64Array(4096 * 4);
  let visivel = new Uint8Array(4096);
  // Lista de faces do quadro, em arrays paralelos para não alocar objeto.
  let faceMesh = [], faceIdx = new Int32Array(2048), faceBase = new Int32Array(2048);
  let faceZ = new Float64Array(2048), faceLuz = new Float64Array(2048);
  let ordem = [];
  let nVert = 0, nFace = 0;
  const mat = new Float64Array(12);
  const mundo = new Float64Array(3);
  const normal = new Float64Array(3);

  function cresce(vertsNecessarios, facesNecessarias) {
    if (vertsNecessarios > visivel.length) {
      const n = 1 << Math.ceil(Math.log2(vertsNecessarios));
      const p = new Float64Array(n * 4), v = new Uint8Array(n);
      p.set(proj); v.set(visivel); proj = p; visivel = v;
    }
    if (facesNecessarias > faceIdx.length) {
      const n = 1 << Math.ceil(Math.log2(facesNecessarias));
      const idx = new Int32Array(n), base = new Int32Array(n), z = new Float64Array(n), luz = new Float64Array(n);
      idx.set(faceIdx); base.set(faceBase); z.set(faceZ); luz.set(faceLuz);
      faceIdx = idx; faceBase = base; faceZ = z; faceLuz = luz;
    }
  }

  function begin() { nVert = 0; nFace = 0; }

  // Põe um objeto na cena. A pose é a do mundo; a malha não é copiada.
  function add(mesh, pose, cam) {
    const base = nVert;
    cresce(nVert + mesh.count, nFace + mesh.faces.length);
    compose(mat, pose);
    // Um passe pelos vértices: transforma para o mundo e projeta.
    for (let i = 0; i < mesh.count; i++) {
      transformPoint(mat, mesh.verts[i * 3], mesh.verts[i * 3 + 1], mesh.verts[i * 3 + 2], mundo, 0);
      visivel[base + i] = project(cam, mundo[0], mundo[1], mundo[2], proj, (base + i) * 4) ? 1 : 0;
    }
    nVert += mesh.count;
    for (let f = 0; f < mesh.faces.length; f++) {
      const face = mesh.faces[f], idx = face.idx;
      // Face com qualquer vértice atrás do plano próximo é descartada inteira.
      // Recortar o polígono daria a borda certa, mas custa por face e por
      // quadro; a diferença só aparece quando a nave encosta na câmera, e aí a
      // face vizinha já cobre o buraco.
      let ok = 1, z = 0;
      for (let k = 0; k < idx.length; k++) {
        const v = base + idx[k];
        if (!visivel[v]) { ok = 0; break; }
        z += proj[v * 4 + 2];
      }
      if (!ok) continue;
      // Descarte de face virada para o outro lado, em área com sinal na tela.
      // Feito depois da projeção, e não pela normal no mundo, porque é a tela
      // que decide: perspectiva pode virar uma face que a normal diz estar de
      // frente, perto da borda do campo.
      const a = (base + idx[0]) * 4, b = (base + idx[1]) * 4, c = (base + idx[2]) * 4;
      const area = (proj[b] - proj[a]) * (proj[c + 1] - proj[a + 1])
                 - (proj[c] - proj[a]) * (proj[b + 1] - proj[a + 1]);
      if (area <= 0) continue;
      // Face menor que uns poucos pixels não acrescenta forma, só custa um
      // caminho no canvas. É o que segura o custo quando a tela enche.
      if (area < 6) continue;
      transformDir(mat, mesh.normals[f * 3], mesh.normals[f * 3 + 1], mesh.normals[f * 3 + 2], normal, 0);
      const nl = Math.hypot(normal[0], normal[1], normal[2]) || 1;
      const difusa = (normal[0] * LUZ[0] + normal[1] * LUZ[1] + normal[2] * LUZ[2]) / nl;
      faceMesh[nFace] = mesh; faceIdx[nFace] = f; faceBase[nFace] = base;
      faceZ[nFace] = z / idx.length;
      // `glow` não escurece: motor e visor continuam acesos de qualquer ângulo.
      faceLuz[nFace] = face.glow ? 1 : Math.max(0, difusa * .78 + .22);
      nFace++;
    }
  }

  // Pinta o que foi acumulado, do mais longe para o mais perto.
  // `fogFloor` é o quanto a névoa pode apagar. Sem piso, o inimigo distante
  // some contra o fundo quase preto da arena e o jogador não tem como planejar
  // — e num atirador, alvo invisível é injustiça, não atmosfera.
  function flush(ctx, { fog = null, fogStart = 600, fogEnd = 2200, fogFloor = .45, edge = 1.8 } = {}) {
    if (!nFace) return 0;
    ordem.length = nFace;
    for (let i = 0; i < nFace; i++) ordem[i] = i;
    const fatia = ordem;
    fatia.sort((a, b) => faceZ[b] - faceZ[a]);
    ctx.lineJoin = 'round';
    for (let k = 0; k < nFace; k++) {
      const i = fatia[k], mesh = faceMesh[i], face = mesh.faces[faceIdx[i]];
      const idx = face.idx, base = faceBase[i];
      ctx.beginPath();
      for (let j = 0; j < idx.length; j++) {
        const v = (base + idx[j]) * 4;
        j ? ctx.lineTo(proj[v], proj[v + 1]) : ctx.moveTo(proj[v], proj[v + 1]);
      }
      ctx.closePath();
      // Névoa pela distância: o que está longe perde contraste contra o fundo.
      // É o que dá leitura de profundidade quando a perspectiva sozinha não
      // basta, que é o caso de um alvo pequeno vindo de frente.
      let alfa = 1;
      if (fog) {
        const t = (faceZ[i] - fogStart) / (fogEnd - fogStart);
        if (t > 0) alfa = Math.max(fogFloor, 1 - t);
      }
      ctx.globalAlpha = alfa;
      ctx.fillStyle = tom(face.color, faceLuz[i]);
      ctx.fill();
      // Contorno só nas faces acesas e nas grandes: é o que dá o traço neon sem
      // pagar um caminho a mais em cada placa pequena do casco.
      if (face.glow || (edge && proj[(base + idx[0]) * 4 + 3] > edge)) {
        ctx.strokeStyle = face.glow ? face.color : (mesh.edge || '#b6c8d4');
        ctx.globalAlpha = alfa * (face.glow ? .35 : .18);
        ctx.lineWidth = face.glow ? .8 : .5;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    const desenhadas = nFace;
    nFace = 0; nVert = 0;
    return desenhadas;
  }

  return { begin, add, flush, get faces() { return nFace; } };
}

