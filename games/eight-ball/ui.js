import { PALETTE_OPTIONS } from '../../core/theme.js';
import { AI } from './config.js';

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
};

function radioGroup(legendText, name, options, current, onChange) {
  const field = el('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = legendText;
  field.appendChild(legend);
  const group = el('div', 'choices');
  for (const [value, label] of options) {
    const wrap = el('label', 'choice');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = current === value;
    input.addEventListener('change', () => onChange(value));
    wrap.append(input, el('span', null, label));
    group.appendChild(wrap);
  }
  field.appendChild(group);
  return field;
}

function switchRow(title, description, checked, onChange, disabled = false) {
  const row = el('div', 'switch-row');
  const left = el('div');
  left.appendChild(el('strong', null, title));
  left.appendChild(el('p', null, description));
  const box = el('label', 'switch');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.disabled = disabled;
  input.addEventListener('change', () => onChange(input.checked));
  box.append(input, document.createElement('i'));
  row.append(left, box);
  return row;
}

export function buildDialog({ settings, theme, audio, haptics, records, duel,
                              onMode, onLevel, onGuide, onNames, onClearDuel, duelFor }) {
  const root = el('div');

  root.appendChild(radioGroup('Partida', 'pool-mode', [
    ['cpu', 'Contra a máquina'], ['local', 'Dois jogadores']
  ], settings.mode, onMode));

  // Nomes e placar do confronto. O placar é guardado por dupla: trocar de
  // nomes começa outra série e voltar aos mesmos recupera a anterior.
  const namesField = el('fieldset');
  const namesLegend = document.createElement('legend');
  namesLegend.textContent = 'Dois jogadores';
  namesField.appendChild(namesLegend);
  const grid = el('div', 'name-grid');
  const board = el('div', 'versus');
  const left = el('span'), score = el('b'), right = el('span');
  board.append(left, score, right);

  const refresh = record => {
    left.textContent = settings.names[0];
    right.textContent = settings.names[1];
    left.title = settings.names[0];
    right.title = settings.names[1];
    score.textContent = `${record.wins[0]} × ${record.wins[1]}`;
    board.setAttribute('aria-label',
      `Placar do confronto: ${settings.names[0]} ${record.wins[0]}, ${settings.names[1]} ${record.wins[1]}`);
  };

  [0, 1].forEach(index => {
    const field = el('div', 'name-field');
    field.appendChild(el('span', null, `Jogador ${index + 1}`));
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 12;
    input.value = settings.names[index];
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', `Nome do jogador ${index + 1}`);
    const apply = () => {
      input.value = onNames(index, input.value);
      refresh(duelFor(settings.names));
    };
    input.addEventListener('change', apply);
    input.addEventListener('blur', apply);
    field.appendChild(input);
    grid.appendChild(field);
  });
  namesField.appendChild(grid);
  namesField.appendChild(board);
  const reset = el('button', 'ghost-button', 'Zerar este placar');
  reset.type = 'button';
  reset.addEventListener('click', () => { onClearDuel(); refresh({ wins: [0, 0] }); });
  namesField.appendChild(reset);
  refresh(duel);
  root.appendChild(namesField);

  root.appendChild(radioGroup('Nível da máquina', 'pool-level',
    Object.entries(AI.levels).map(([key, level]) => [key, level.label]),
    settings.level, onLevel));

  root.appendChild(radioGroup('Aparência', 'theme', [['dark', 'Escuro'], ['light', 'Claro']],
    theme.mode, value => theme.setMode(value)));

  root.appendChild(radioGroup('Cor neon', 'palette',
    PALETTE_OPTIONS.filter(o => o.value !== 'auto').map(o => [o.value, o.label]),
    theme.choice === 'auto' ? 'purple' : theme.choice, value => theme.setChoice(value)));

  const prefs = el('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Preferências';
  prefs.appendChild(legend);
  prefs.appendChild(switchRow('Linha de saída',
    'Mostra para onde a bola alvo deve sair depois do contato.', settings.guide, onGuide));
  prefs.appendChild(switchRow('Som', 'Impacto das bolas, tabela e caçapa.',
    audio.enabled, value => audio.setEnabled(value)));
  prefs.appendChild(switchRow('Vibração',
    haptics.supported ? 'Retorno tátil na tacada e na caçapa.' : 'Não disponível neste aparelho.',
    haptics.enabled, value => haptics.setEnabled(value), !haptics.supported));
  root.appendChild(prefs);

  root.appendChild(el('h3', 'guide-title', 'Como jogar'));
  const how = el('ul');
  [
    'Arraste em qualquer ponto do pano para girar a mira. Quanto mais longe da branca, mais fino o ajuste.',
    'Arraste a barra de força à direita e solte para tacar: soltar no zero cancela.',
    'No teclado: setas laterais miram, setas verticais ajustam a força, espaço taca.',
    'Depois de uma falta você joga com a bola na mão — toque no pano para posicionar a branca.'
  ].forEach(text => how.appendChild(el('li', null, text)));
  root.appendChild(how);

  root.appendChild(el('h3', 'guide-title', 'Regras'));
  const rules = el('ul');
  [
    'Encaçapar na saída NÃO define o grupo: a mesa continua aberta e quem decide é a primeira bola que cair na tacada seguinte.',
    'A branca precisa acertar primeiro uma bola do seu grupo. Depois do contato, alguma bola tem de cair ou ir à tabela.',
    'Falta dá bola na mão ao adversário: branca na caçapa, contato errado ou nenhuma bola na tabela.',
    'A 8 é a última. Encaçapar a 8 antes da hora, ou junto de uma falta, perde a partida.',
    'Na saída é preciso encaçapar alguma bola ou levar quatro à tabela. A 8 na saída volta para o pé da mesa.'
  ].forEach(text => rules.appendChild(el('li', null, text)));
  root.appendChild(rules);

  root.appendChild(el('h3', 'guide-title', 'Retrospecto'));
  const list = el('div', 'records');
  const row = el('div', 'record');
  row.appendChild(el('span', null, 'Contra a máquina'));
  row.appendChild(el('b', null, `${records.cpu.wins} vitórias · ${records.cpu.losses} derrotas`));
  list.appendChild(row);
  const duelRow = el('div', 'record');
  duelRow.appendChild(el('span', null, 'Confronto atual'));
  duelRow.appendChild(el('b', null, `${duel.wins[0]} × ${duel.wins[1]}`));
  list.appendChild(duelRow);
  root.appendChild(list);

  return root;
}
