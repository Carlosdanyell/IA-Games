import { createRng } from '../../core/rng.js';
import { PALETTE_CYCLE } from '../../core/theme.js';

// Campanha: 25 fases. A dificuldade cresce por quatro eixos independentes —
// distância, vento, alvo em movimento e tamanho da maçã — combinados aos poucos,
// para que cada fase nova ensine uma coisa de cada vez.
//
//   distance  metros entre o arqueiro e o alvo (a cena sempre cabe na tela;
//             o que muda é a física e o quanto as figuras encolhem)
//   wind      módulo máximo do vento, em m/s². Sorteado a cada flecha e sempre
//             mostrado no placar e pela bandeira — nunca é surpresa
//   pace      passo horizontal do alvo: { range (m), speed (m/s) }
//   lift      oscilação vertical do alvo: { range (m), speed (rad/s) }
//   apple     multiplicador do raio da maçã
export const PHASES = [
  { name: 'PRIMEIRA CORDA', palette: 'verde', distance: 20, wind: 0, apple: 1,
    hint: 'Arraste para trás como se puxasse a corda e solte. A linha pontilhada mostra o caminho.' },
  { name: 'PULSO FIRME', palette: 'verde', distance: 22.5, wind: 0, apple: 1,
    hint: 'Quanto mais longe você puxa, mais força. O ângulo é a direção do arrasto, ao contrário.' },
  { name: 'RESPIRA', palette: 'cyan', distance: 25, wind: 0, apple: 1,
    hint: 'A gravidade é real: mire um pouco acima da maçã nas distâncias maiores.' },
  { name: 'DISTÂNCIA', palette: 'cyan', distance: 27.5, wind: 0, apple: 1,
    hint: 'As figuras encolhem conforme o campo se abre. A maçã continua do mesmo tamanho no mundo.' },
  { name: 'BRISA', palette: 'azul', distance: 28, wind: 2, apple: 1,
    hint: 'Vento fraco. A bandeira e o placar mostram para onde ele sopra e com que força.' },
  { name: 'LESTE', palette: 'azul', distance: 30, wind: 2.8, apple: 1,
    hint: 'Vento a favor alonga o tiro; contra, encurta. Corrija na força antes do ângulo.' },
  { name: 'CORREDOR', palette: 'azul', distance: 32, wind: 3.4, apple: 1,
    hint: 'O vento muda a cada flecha. Confira o placar antes de puxar a corda.' },
  { name: 'RAJADA', palette: 'ambar', distance: 33, wind: 4.2, apple: 1,
    hint: 'Com vento forte, um grau de ângulo vale mais que dez por cento de força.' },
  { name: 'PASSO CURTO', palette: 'ambar', distance: 34, wind: 3, apple: 1,
    pace: { range: 1.2, speed: 0.9 },
    hint: 'O alvo anda. Dispare quando ele estiver no ponto de retorno: ali ele fica parado por um instante.' },
  { name: 'VAI E VEM', palette: 'ambar', distance: 35.5, wind: 3.4, apple: 1,
    pace: { range: 1.8, speed: 1.1 },
    hint: 'Mire onde o alvo vai estar quando a flecha chegar, não onde ele está.' },
  { name: 'PLATAFORMA', palette: 'rosa', distance: 36, wind: 2.6, apple: 1,
    lift: { range: 0.9, speed: 1.2 },
    hint: 'A plataforma sobe e desce. A maçã acompanha: o ângulo muda mais que a força.' },
  { name: 'MARÉ', palette: 'rosa', distance: 37.5, wind: 3.6, apple: 0.95,
    lift: { range: 1.2, speed: 1 },
    hint: 'Maçã um pouco menor. Vale esperar o topo ou o fundo do movimento.' },
  { name: 'CRUZADO', palette: 'rosa', distance: 38.5, wind: 4.6, apple: 0.95,
    pace: { range: 1.6, speed: 1.2 },
    hint: 'Vento e passo ao mesmo tempo: some as duas correções antes de soltar.' },
  { name: 'NORTE', palette: 'purple', distance: 40, wind: 5, apple: 0.92,
    pace: { range: 1.8, speed: 1.3 },
    hint: 'Distância longa pede força quase cheia. Sobrou linha? Baixe o ângulo.' },
  { name: 'TRAVESSIA', palette: 'purple', distance: 41, wind: 4.4, apple: 0.9,
    lift: { range: 1.4, speed: 1.3 },
    hint: 'Acerto seguido vale bônus crescente. Errar a pessoa zera a sequência.' },
  { name: 'FIO', palette: 'purple', distance: 42, wind: 5.2, apple: 0.88,
    pace: { range: 2, speed: 1.4 }, lift: { range: 0.8, speed: 1.1 },
    hint: 'Os dois movimentos juntos. Procure o instante em que eles se cancelam.' },
  { name: 'DESFILADEIRO', palette: 'orange', distance: 43, wind: 5.6, apple: 0.86,
    pace: { range: 1.6, speed: 1.5 },
    hint: 'Vento forte e alvo rápido: a primeira flecha é reconhecimento, a segunda é a boa.' },
  { name: 'ALTO-FORNO', palette: 'orange', distance: 44, wind: 5, apple: 0.84,
    lift: { range: 1.6, speed: 1.4 },
    hint: 'Com a plataforma alta, a flecha chega descendo. Mire no topo da maçã.' },
  { name: 'ESTREITO', palette: 'orange', distance: 45, wind: 6, apple: 0.82,
    pace: { range: 2.2, speed: 1.5 },
    hint: 'Menos margem: a assistência da hitbox some quase toda nas maçãs pequenas.' },
  { name: 'CONTRAVENTO', palette: 'red', distance: 45.5, wind: 6.4, apple: 0.8,
    pace: { range: 1.8, speed: 1.6 }, lift: { range: 1, speed: 1.3 },
    hint: 'Vento máximo contra. Puxe a corda até o fim e ajuste só o ângulo.' },
  { name: 'PÊNDULO', palette: 'red', distance: 46, wind: 5.4, apple: 0.78,
    lift: { range: 1.8, speed: 1.5 },
    hint: 'O movimento é senoidal: a velocidade é máxima no meio e zero nas pontas.' },
  { name: 'AGULHA', palette: 'red', distance: 46.5, wind: 6, apple: 0.76,
    pace: { range: 2.4, speed: 1.7 },
    hint: 'Alvo em passo largo. Solte um pouco antes do que o instinto pede.' },
  { name: 'ÚLTIMO SOL', palette: 'red', distance: 47, wind: 6.4, apple: 0.74,
    pace: { range: 2, speed: 1.6 }, lift: { range: 1.4, speed: 1.4 },
    hint: 'Três variáveis somadas. Respire, olhe a bandeira e conte o ritmo.' },
  { name: 'CORDA TENSA', palette: 'red', distance: 47.5, wind: 6.8, apple: 0.72,
    pace: { range: 2.2, speed: 1.8 }, lift: { range: 1.6, speed: 1.5 },
    hint: 'Penúltima. Aqui a sequência de acertos costuma valer mais que a fase em si.' },
  { name: 'MÃO FIRME', palette: 'red', distance: 48, wind: 7, apple: 0.7,
    pace: { range: 2.4, speed: 1.8 }, lift: { range: 1.8, speed: 1.6 },
    hint: 'A última. Maçã mínima, vento máximo e alvo em movimento nos dois eixos.' }
];

// Modo infinito e desafio diário: fase gerada, sempre reproduzível pela semente.
export function generatePhase(index, seed) {
  const rng = createRng((seed ^ (index * 2654435761)) >>> 0);
  const t = Math.min(1, index / 24);
  const distance = Math.round((20 + t * 28 + rng.next() * 3) * 10) / 10;
  const wind = Math.round((t * 6.5 + rng.next() * 1.5) * 10) / 10;
  const phase = {
    name: `CAMPO ${String(index + 1).padStart(2, '0')}`,
    palette: PALETTE_CYCLE[index % PALETTE_CYCLE.length],
    distance,
    wind: index < 3 ? 0 : wind,
    apple: Math.max(0.7, 1 - t * 0.3),
    hint: 'Fase gerada: distância, vento e movimento sorteados para esta rodada.'
  };
  if (index >= 6 && rng.chance(0.6)) {
    phase.pace = { range: 1 + rng.next() * (1 + t), speed: 0.8 + rng.next() * (1 + t) };
  }
  if (index >= 9 && rng.chance(0.5)) {
    phase.lift = { range: 0.7 + rng.next() * (1 + t), speed: 1 + rng.next() * 0.7 };
  }
  return phase;
}

export const phaseFor = (mode, index, seed) =>
  mode === 'campaign' ? PHASES[Math.min(index, PHASES.length - 1)] : generatePhase(index, seed);
