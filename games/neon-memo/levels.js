// As 25 fases do Neon Memo.
//
// Cada fase escolhe uma regra (ver RULES em model.js), quantos conjuntos
// existem no tabuleiro, de quais famílias de figuras eles saem e quanto tempo
// dura a espiada inicial. `cols * rows` tem que bater com o total de cartas —
// o teste tests/neon-memo.test.mjs confere isso.
export const LEVELS = [
  { id: 1,  name: 'Quintal',            rule: 'classico',  groups: 3,  cols: 2, rows: 3, families: ['animais'],               peek: 3.0, hints: 3, palette: 'verde' },
  { id: 2,  name: 'Pomar',              rule: 'classico',  groups: 4,  cols: 2, rows: 4, families: ['frutas'],                peek: 2.8, hints: 3, palette: 'red' },
  { id: 3,  name: 'Garagem',            rule: 'classico',  groups: 6,  cols: 3, rows: 4, families: ['transporte'],            peek: 2.6, hints: 3, palette: 'azul' },
  { id: 4,  name: 'Ensaio',             rule: 'classico',  groups: 6,  cols: 3, rows: 4, families: ['musica'],                peek: 2.4, hints: 3, palette: 'purple' },
  { id: 5,  name: 'Sala de Casa',       rule: 'classico',  groups: 8,  cols: 4, rows: 4, families: ['casa'],                  peek: 2.4, hints: 3, palette: 'ambar' },
  { id: 6,  name: 'Trio no Bosque',     rule: 'trinca',    groups: 3,  cols: 3, rows: 3, families: ['animais'],               peek: 3.0, hints: 3, palette: 'verde' },
  { id: 7,  name: 'Jardim',             rule: 'classico',  groups: 8,  cols: 4, rows: 4, families: ['natureza'],              peek: 2.2, hints: 3, palette: 'cyan' },
  { id: 8,  name: 'Cada Um no Seu Tema',rule: 'categoria', groups: 4,  cols: 2, rows: 4, families: 'todas',                   peek: 3.0, hints: 3, palette: 'rosa' },
  { id: 9,  name: 'Beira-mar',          rule: 'classico',  groups: 10, cols: 4, rows: 5, families: ['mar', 'natureza'],       peek: 2.2, hints: 3, palette: 'cyan' },
  { id: 10, name: 'Disfarce',           rule: 'coringa',   groups: 7,  cols: 4, rows: 4, families: 'todas',                   peek: 2.6, hints: 3, palette: 'verde' },
  { id: 11, name: 'Feira de Frutas',    rule: 'trinca',    groups: 4,  cols: 3, rows: 4, families: ['frutas'],                peek: 2.6, hints: 3, palette: 'orange' },
  { id: 12, name: 'Ginásio',            rule: 'classico',  groups: 10, cols: 4, rows: 5, families: ['esportes', 'transporte'],peek: 2.0, hints: 3, palette: 'ambar' },
  { id: 13, name: 'Relâmpago I',        rule: 'relampago', groups: 8,  cols: 4, rows: 4, families: 'todas',                   peek: 2.2, hints: 2, palette: 'red',   limit: 75 },
  { id: 14, name: 'Troca-troca',        rule: 'troca',     groups: 10, cols: 4, rows: 5, families: ['casa', 'natureza'],      peek: 2.4, hints: 3, palette: 'purple' },
  { id: 15, name: 'Mercado',            rule: 'classico',  groups: 12, cols: 4, rows: 6, families: 'todas',                   peek: 2.0, hints: 3, palette: 'orange' },
  { id: 16, name: 'Arquivo por Temas',  rule: 'categoria', groups: 6,  cols: 3, rows: 4, families: 'todas',                   peek: 2.8, hints: 3, palette: 'rosa' },
  { id: 17, name: 'Trio do Fundo',      rule: 'trinca',    groups: 5,  cols: 3, rows: 5, families: ['mar'],                   peek: 2.4, hints: 3, palette: 'cyan' },
  { id: 18, name: 'Bairro',             rule: 'classico',  groups: 15, cols: 5, rows: 6, families: 'todas',                   peek: 1.8, hints: 3, palette: 'azul' },
  { id: 19, name: 'Relâmpago II',       rule: 'relampago', groups: 12, cols: 4, rows: 6, families: 'todas',                   peek: 1.8, hints: 2, palette: 'red',   limit: 110 },
  { id: 20, name: 'Disfarce Duplo',     rule: 'coringa',   groups: 14, cols: 5, rows: 6, families: 'todas',                   peek: 1.8, hints: 3, palette: 'verde' },
  { id: 21, name: 'Roda-viva',          rule: 'troca',     groups: 15, cols: 5, rows: 6, families: 'todas',                   peek: 1.8, hints: 3, palette: 'purple' },
  { id: 22, name: 'Museu',              rule: 'classico',  groups: 18, cols: 6, rows: 6, families: 'todas',                   peek: 1.6, hints: 3, palette: 'ambar' },
  { id: 23, name: 'Oito Temas',         rule: 'trio',      groups: 8,  cols: 4, rows: 6, families: 'todas',                   peek: 2.4, hints: 3, palette: 'rosa' },
  { id: 24, name: 'Doze Trincas',       rule: 'trinca',    groups: 12, cols: 6, rows: 6, families: 'todas',                   peek: 2.0, hints: 3, palette: 'orange' },
  { id: 25, name: 'Grande Final',       rule: 'relampago', groups: 18, cols: 6, rows: 6, families: 'todas',                   peek: 1.6, hints: 1, palette: 'red',   limit: 200 }
];

export const LAST = LEVELS.length - 1;

// Desafio do dia: mesmo tabuleiro para todo mundo, sorteado pela data.
// A regra muda conforme o dia da semana, então a rotina não vira decoreba.
const DAILY_RULES = ['classico', 'trinca', 'categoria', 'coringa', 'troca', 'relampago', 'trio'];

export function dailyLevel(seed, label) {
  const rule = DAILY_RULES[seed % DAILY_RULES.length];
  const plan = {
    classico:  { groups: 10, cols: 4, rows: 5, limit: null },
    trinca:    { groups: 6,  cols: 3, rows: 6, limit: null },
    categoria: { groups: 6,  cols: 3, rows: 4, limit: null },
    coringa:   { groups: 9,  cols: 4, rows: 5, limit: null },
    troca:     { groups: 10, cols: 4, rows: 5, limit: null },
    relampago: { groups: 10, cols: 4, rows: 5, limit: 90 },
    trio:      { groups: 8,  cols: 4, rows: 6, limit: null }
  }[rule];
  return { id: 0, daily: true, name: 'Desafio de ' + label, rule, families: 'todas',
    peek: 2.2, hints: 2, palette: 'cyan', ...plan };
}
