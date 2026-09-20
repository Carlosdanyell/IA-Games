// Regras do Neon Memo. Nenhuma dependência de DOM, relógio ou rede: o mesmo
// código roda no navegador e no `node --test`.
import { createRng } from '../../core/rng.js';
import { FAMILIES, familyFigures, figure, WILD } from './figures.js';

export const RULES = {
  classico:  { label: 'Clássico',      size: 2, how: 'Vire duas cartas e encontre as figuras iguais.' },
  trinca:    { label: 'Trinca',        size: 3, how: 'Cada figura aparece três vezes. Só fecha quando as três abrem juntas.' },
  categoria: { label: 'Por tema',      size: 2, byFamily: true, how: 'O par é por tema: duas figuras do mesmo grupo combinam.' },
  trio:      { label: 'Trio temático', size: 3, byFamily: true, how: 'Três figuras do mesmo tema fecham o conjunto.' },
  coringa:   { label: 'Camaleão',      size: 2, wilds: 2, how: 'O camaleão imita a figura que abrir com ele e leva o par inteiro.' },
  troca:     { label: 'Troca-troca',   size: 2, swapEvery: 2, how: 'A cada dois erros, duas cartas viradas para baixo trocam de lugar.' },
  relampago: { label: 'Relâmpago',     size: 2, timed: true, how: 'Feche o tabuleiro antes de o tempo acabar.' }
};

const MAX_COMBO = 5;

export function ruleOf(level) { return RULES[level.rule] || RULES.classico; }
export function setSize(level) { return level.size || ruleOf(level).size; }
export function wildCount(level) { return level.wilds ?? ruleOf(level).wilds ?? 0; }
export function cardCount(level) { return level.groups * setSize(level) + wildCount(level); }
export function timeLimit(level) { return ruleOf(level).timed ? (level.limit || 90) : null; }

// Movimentos que valem três estrelas. Um tabuleiro de n conjuntos precisa de
// pelo menos n jogadas certas; a folga cobre a fase de reconhecimento.
export function parMoves(level) {
  if (level.par) return level.par;
  return Math.round(level.groups * (setSize(level) > 2 ? 2.4 : 1.8));
}

function shuffle(list, rng) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const familyList = level => (level.families === 'todas' || !level.families)
  ? FAMILIES.map(item => item.id)
  : level.families.filter(id => FAMILIES.some(item => item.id === id));

// Monta o baralho da fase. O mesmo seed devolve sempre o mesmo tabuleiro:
// é isso que faz o desafio do dia ser igual para todo mundo e os testes
// serem reproduzíveis.
export function buildDeck(level, seed = 1) {
  const rng = createRng(seed);
  const rule = ruleOf(level);
  const size = setSize(level);
  const families = familyList(level);
  const cards = [];

  if (rule.byFamily) {
    const chosen = shuffle(families, rng).slice(0, level.groups);
    if (chosen.length < level.groups) throw new Error(`${level.name}: faltam temas para ${level.groups} conjuntos`);
    for (const family of chosen) {
      const options = shuffle(familyFigures(family), rng).slice(0, size);
      if (options.length < size) throw new Error(`${level.name}: tema ${family} não tem ${size} figuras`);
      for (const item of options) cards.push({ figure: item.id, family, group: 'tema:' + family, wild: false });
    }
  } else {
    const pool = shuffle(families.flatMap(family => familyFigures(family)), rng);
    if (pool.length < level.groups) throw new Error(`${level.name}: faltam figuras para ${level.groups} conjuntos`);
    for (const item of pool.slice(0, level.groups)) {
      for (let copy = 0; copy < size; copy++) {
        cards.push({ figure: item.id, family: item.family, group: 'fig:' + item.id, wild: false });
      }
    }
  }

  const wild = figure(WILD);
  for (let i = 0; i < wildCount(level); i++) {
    cards.push({ figure: wild.id, family: wild.family, group: 'coringa:' + i, wild: true });
  }
  return shuffle(cards, rng);
}

const sane = (value, fallback = 0) => (Number.isFinite(value) && value >= 0 ? value : fallback);

export function createSession(level, { seed = 1, saved = null } = {}) {
  const rule = ruleOf(level);
  const size = setSize(level);
  const limit = timeLimit(level);
  const rng = createRng(seed ^ 0x9e3779b9);

  let cards = Array.isArray(saved?.layout) && saved.layout.length === cardCount(level)
    ? saved.layout.map(entry => ({ figure: entry.f, family: figure(entry.f)?.family || 'coringa', group: entry.g, wild: !!entry.w }))
    : buildDeck(level, seed);
  cards = cards.map((card, index) => ({ ...card, index }));

  const matched = new Set((Array.isArray(saved?.matched) ? saved.matched : [])
    .filter(group => cards.some(card => card.group === group)));
  let faceUp = [], pending = [];
  let moves = sane(saved?.moves), mistakes = sane(saved?.mistakes), score = sane(saved?.score);
  let combo = 0, bestCombo = sane(saved?.bestCombo);
  let hintsUsed = Math.min(level.hints, sane(saved?.hintsUsed));
  let elapsed = sane(saved?.elapsed);
  let status = 'playing';

  const openGroups = () => [...new Set(cards.filter(card => !matched.has(card.group)).map(card => card.group))];
  const complete = () => openGroups().length === 0;
  if (complete()) status = 'done';

  function evaluate(indices) {
    const chosen = indices.map(index => cards[index]);
    const wilds = chosen.filter(card => card.wild);
    if (wilds.length) {
      // O camaleão só existe em fases de pares: ele fecha com qualquer carta e
      // leva junto a figura inteira — nunca sobra uma carta órfã no tabuleiro.
      const partner = chosen.find(card => !card.wild);
      return { groups: partner ? [wilds[0].group, partner.group] : chosen.map(card => card.group), wild: true };
    }
    if (rule.byFamily) {
      const same = chosen.every(card => card.family === chosen[0].family);
      return same ? { groups: [chosen[0].group] } : null;
    }
    const same = chosen.every(card => card.figure === chosen[0].figure);
    return same ? { groups: [chosen[0].group] } : null;
  }

  function swapCards() {
    const free = cards.filter(card => !matched.has(card.group) && !faceUp.includes(card.index) && !pending.includes(card.index));
    if (free.length < 2) return [];
    const a = free[Math.floor(rng.next() * free.length)];
    const rest = free.filter(card => card !== a);
    const b = rest[Math.floor(rng.next() * rest.length)];
    const ai = a.index, bi = b.index;
    cards[ai] = b; cards[bi] = a; b.index = ai; a.index = bi;
    return [[ai, bi]];
  }

  const api = {
    level, size, limit,
    get cards() { return cards; },
    get status() { return status; },
    get moves() { return moves; },
    get mistakes() { return mistakes; },
    get score() { return score; },
    get combo() { return combo; },
    get bestCombo() { return bestCombo; },
    get elapsed() { return elapsed; },
    get timeLeft() { return limit ? Math.max(0, limit - elapsed) : null; },
    get hintsLeft() { return Math.max(0, level.hints - hintsUsed); },
    get faceUp() { return [...faceUp]; },
    get pending() { return [...pending]; },
    get total() { return level.groups + wildCount(level); },
    get found() { return api.total - openGroups().length; },
    get complete() { return complete(); },
    isMatched: index => matched.has(cards[index]?.group),
    isFaceUp: index => faceUp.includes(index) || pending.includes(index),

    // Vira uma carta. Quando o conjunto fecha o número de cartas da regra, a
    // jogada é resolvida na hora; o erro fica em `pending` até a interface
    // desvirar (ou até o jogador tocar na carta seguinte).
    flip(index) {
      if (status !== 'playing') return { status: 'blocked' };
      if (pending.length) api.settle();
      const card = cards[index];
      if (!card || matched.has(card.group) || faceUp.includes(index)) return { status: 'blocked' };
      faceUp.push(index);
      if (faceUp.length < size) return { status: 'up', index };

      const chosen = [...faceUp];
      faceUp = [];
      moves++;
      const hit = evaluate(chosen);
      if (!hit) {
        mistakes++;
        combo = 0;
        pending = chosen;
        const swaps = rule.swapEvery && mistakes % rule.swapEvery === 0 ? swapCards() : [];
        return { status: 'miss', cards: chosen, swaps, moves };
      }
      for (const group of hit.groups) matched.add(group);
      combo = Math.min(MAX_COMBO, combo + 1);
      bestCombo = Math.max(bestCombo, combo);
      const points = 100 + (combo - 1) * 40 + (hit.wild ? 60 : 0);
      score += points;
      const cleared = cards.filter(item => hit.groups.includes(item.group)).map(item => item.index);
      if (complete()) {
        status = 'done';
        if (limit) score += Math.round(api.timeLeft) * 4;
      }
      return { status: 'match', cards: cleared, opened: chosen, groups: hit.groups,
        points, combo, wild: !!hit.wild, complete: complete(), moves };
    },

    // Devolve as cartas erradas para baixo.
    settle() {
      if (!pending.length) return [];
      const list = pending;
      pending = [];
      return list;
    },

    // Dica: devolve as cartas de um conjunto ainda fechado para a interface
    // mostrar por alguns instantes. Não conta como jogada.
    hint() {
      if (status !== 'playing' || api.hintsLeft <= 0) return null;
      const options = openGroups().filter(group => !cards.some(card => card.group === group && faceUp.includes(card.index)));
      const group = options[0];
      if (!group) return null;
      hintsUsed++;
      score = Math.max(0, score - 30);
      return { group, cards: cards.filter(card => card.group === group).map(card => card.index), left: api.hintsLeft };
    },

    tick(dt) {
      if (status !== 'playing') return status;
      elapsed += dt;
      if (limit && elapsed >= limit) { status = 'timeout'; elapsed = limit; }
      return status;
    },

    stars() {
      if (!complete()) return 0;
      const par = parMoves(level);
      if (moves <= par) return 3;
      if (moves <= Math.ceil(par * 1.4)) return 2;
      return 1;
    },

    snapshot: () => ({
      layout: cards.map(card => (card.wild ? { f: card.figure, g: card.group, w: 1 } : { f: card.figure, g: card.group })),
      matched: [...matched], moves, mistakes, score, bestCombo, hintsUsed, elapsed: Math.round(elapsed)
    })
  };
  return api;
}
