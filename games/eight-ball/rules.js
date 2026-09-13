import { TABLE, BALL } from './config.js';

export const groupOf = number =>
  number === 0 ? 'cue' : number === 8 ? 'eight' : number < 8 ? 'solid' : 'stripe';

export const GROUP_LABEL = { solid: 'Lisas', stripe: 'Listradas' };

function rackPositions() {
  const spacing = BALL.r * 2 + BALL.gap;
  const dx = spacing * Math.cos(Math.PI / 6);
  const spots = [];
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      spots.push({
        row, i,
        x: TABLE.footX + row * dx,
        y: TABLE.centerY + (i - row / 2) * spacing
      });
    }
  }
  return spots;
}

// Triângulo conforme a regra: 8 no centro da terceira fila e, nos dois cantos
// de trás, uma lisa e uma listrada. O resto entra embaralhado.
export function createRack(rng) {
  const spots = rackPositions();
  const eightAt = spots.findIndex(s => s.row === 2 && s.i === 1);
  const backLeft = spots.findIndex(s => s.row === 4 && s.i === 0);
  const backRight = spots.findIndex(s => s.row === 4 && s.i === 4);

  const solids = [1, 2, 3, 4, 5, 6, 7];
  const stripes = [9, 10, 11, 12, 13, 14, 15];
  const take = list => list.splice(Math.floor(rng() * list.length), 1)[0];

  const numbers = new Array(spots.length).fill(null);
  numbers[eightAt] = 8;
  numbers[backLeft] = take(solids);
  numbers[backRight] = take(stripes);

  const rest = [...solids, ...stripes];
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  for (let i = 0; i < numbers.length; i++) if (numbers[i] === null) numbers[i] = rest.pop();

  const balls = [{
    id: 0, number: 0, group: 'cue', r: BALL.r, active: true,
    x: TABLE.headX, y: TABLE.centerY, vx: 0, vy: 0
  }];
  spots.forEach((spot, index) => {
    const number = numbers[index];
    balls.push({
      id: number, number, group: groupOf(number), r: BALL.r, active: true,
      x: spot.x, y: spot.y, vx: 0, vy: 0
    });
  });
  return balls;
}

export const remainingOf = (balls, group) =>
  balls.filter(b => b.active && b.group === group).length;

// Avalia a tacada inteira a partir do que a simulação registrou.
//
// `shot` = { firstHit, pocketed[], railAfterHit, cueScratched, railBalls }
export function evaluateShot(state, shot) {
  const { balls } = state;
  const player = state.turn;
  const myGroup = state.groups[player];
  const potted = shot.pocketed.filter(n => n !== 0);
  const pottedEight = potted.includes(8);
  const out = { foul: false, reason: '', keepTurn: false, assigned: null, over: false, winner: null };

  const groupCleared = g => g && remainingOf(balls, g) === 0;

  // 1. Saída: precisa pôr bola ou levar quatro à tabela.
  if (state.stage === 'break') {
    if (!potted.length && shot.railBalls < 4) {
      out.foul = true;
      out.reason = 'Saída fraca: nenhuma bola encaçapada e menos de quatro na tabela.';
    }
    if (shot.cueScratched) { out.foul = true; out.reason = 'Branca na caçapa na saída.'; }
    if (pottedEight) {
      // 8 na saída: volta ao pé da mesa, sem falta.
      out.reason = out.reason || 'A 8 voltou para a mesa.';
      out.respotEight = true;
    }
    out.keepTurn = !out.foul && potted.some(n => n !== 8);
    return out;
  }

  // 2. Primeiro contato legal.
  const legalFirst = (() => {
    if (!shot.firstHit) return false;
    const hitGroup = groupOf(shot.firstHit);
    if (groupCleared(myGroup)) return hitGroup === 'eight';
    if (!myGroup) return hitGroup !== 'eight';           // mesa aberta
    return hitGroup === myGroup;
  })();

  if (!shot.firstHit) { out.foul = true; out.reason = 'A branca não acertou nenhuma bola.'; }
  else if (!legalFirst) {
    out.foul = true;
    out.reason = groupOf(shot.firstHit) === 'eight'
      ? 'A branca acertou a 8 primeiro.'
      : 'A branca acertou o grupo do adversário primeiro.';
  } else if (!potted.length && !shot.railAfterHit) {
    out.foul = true;
    out.reason = 'Depois do contato, nenhuma bola foi à tabela.';
  }
  if (shot.cueScratched) { out.foul = true; out.reason = 'Branca na caçapa.'; }

  // 3. A 8 decide a partida.
  if (pottedEight) {
    out.over = true;
    const ready = groupCleared(myGroup) && myGroup;
    out.winner = (ready && !out.foul) ? player : 1 - player;
    out.reason = ready && !out.foul
      ? 'A 8 caiu na hora certa.'
      : out.foul ? 'A 8 caiu em jogada faltosa.' : 'A 8 caiu antes da hora.';
    return out;
  }

  // 4. Mesa aberta: o grupo é definido pela primeira bola encaçapada em jogada
  //    legal, e nunca pela saída.
  if (!myGroup && !out.foul && potted.length) {
    const first = potted.find(n => n !== 8);
    if (first) {
      out.assigned = groupOf(first);
      state.groups[player] = out.assigned;
      state.groups[1 - player] = out.assigned === 'solid' ? 'stripe' : 'solid';
    }
  }

  // 5. Segue na mesa quem encaçapou do próprio grupo sem falta.
  const group = state.groups[player];
  out.keepTurn = !out.foul && potted.some(n => groupOf(n) === group);
  return out;
}
