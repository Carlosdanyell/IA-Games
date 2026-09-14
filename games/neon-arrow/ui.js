import { PALETTE_OPTIONS } from '../../core/theme.js';
import { BLOOD, DIFFICULTY } from './config.js';

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

export function buildDialog({ settings, theme, audio, haptics, modes, records,
                              onMode, onDifficulty, onGuide, onBlood }) {
  const root = el('div');

  root.appendChild(radioGroup('Modo', 'arrow-mode',
    Object.entries(modes).map(([key, mode]) => [key, mode.label]), settings.mode, onMode));

  // A dificuldade mexe em quatro coisas de uma vez, então a explicação do
  // nível escolhido fica logo abaixo e muda junto.
  const guideNote = el('p', 'panel-note');
  const applyNote = value => {
    const d = DIFFICULTY[value];
    guideNote.textContent = `${d.note} Pontos ×${d.bonus} · ${d.lives} ${d.lives === 1 ? 'vida' : 'vidas'}.`;
  };
  root.appendChild(radioGroup('Dificuldade', 'arrow-difficulty',
    Object.entries(DIFFICULTY).map(([key, d]) => [key, d.label]), settings.difficulty,
    value => { applyNote(value); onDifficulty(value); }));
  applyNote(settings.difficulty);
  root.appendChild(guideNote);

  root.appendChild(radioGroup('Sangue', 'arrow-blood',
    Object.entries(BLOOD.levels).map(([key, level]) => [key, level.label]), settings.blood, onBlood));

  root.appendChild(radioGroup('Aparência', 'theme', [['dark', 'Escuro'], ['light', 'Claro']],
    theme.mode, value => theme.setMode(value)));

  root.appendChild(radioGroup('Cor neon', 'palette',
    PALETTE_OPTIONS.map(o => [o.value, o.label]),
    theme.choice, value => theme.setChoice(value)));

  const prefs = el('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Preferências';
  prefs.appendChild(legend);
  prefs.appendChild(switchRow('Linha de tiro',
    'Mostra a trajetória prevista. O quanto dela aparece depende da dificuldade — no Mestre não aparece nada.',
    settings.guide, onGuide));
  prefs.appendChild(switchRow('Som', 'Corda, zunido da flecha, maçã, impacto e o grito de quem leva a flechada.',
    audio.enabled, value => audio.setEnabled(value)));
  prefs.appendChild(switchRow('Vibração',
    haptics.supported ? 'Retorno tátil no disparo e no acerto.' : 'Não disponível neste aparelho.',
    haptics.enabled, value => haptics.setEnabled(value), !haptics.supported));
  root.appendChild(prefs);

  root.appendChild(el('h3', 'guide-title', 'Como jogar'));
  const how = el('ul');
  [
    'Só na horizontal: em pé o jogo pausa e pede para girar o aparelho.',
    'Arraste em qualquer ponto do campo para puxar a corda: a flecha sai na direção oposta ao arrasto.',
    'Quanto mais longe você arrasta, mais força. Soltar quase no ponto de partida cancela o tiro.',
    'No teclado: setas laterais ajustam o ângulo, setas verticais a força, espaço dispara.',
    'A trajetória sofre gravidade e vento. A bandeira e o placar mostram a direção e a força do vento.',
    'O alvo anda e a plataforma oscila nas fases avançadas: atire onde ele vai estar, não onde está.',
    'Olhe para a cara dele: o susto enquanto você puxa a corda entrega o quanto a mira está apontada para a pessoa.'
  ].forEach(text => how.appendChild(el('li', null, text)));
  root.appendChild(how);

  root.appendChild(el('h3', 'guide-title', 'Pontos e vidas'));
  const rules = el('ul');
  [
    'Acertar a maçã passa de fase. Vale mais no centro, na primeira flecha e em sequência.',
    'Acertar a pessoa custa uma vida e zera a sequência. Errar tudo só zera a sequência.',
    'A partir da fase 10 pode aparecer uma lanterna no meio do caminho: acertá-la dá uma vida (ou 180 pontos, se já estiver no máximo). Gasta a flecha e não passa de fase — é uma troca.',
    'A dificuldade multiplica os pontos: Fácil ×0,75, Normal ×1, Difícil ×1,4 e Mestre ×2.',
    'Vida extra a cada 2.500 pontos e a cada 6 acertos seguidos, até o máximo de 5.',
    'A campanha guarda a fase e a dificuldade: dá para fechar o jogo e continuar de onde parou.',
    'O desafio diário sorteia 5 fases iguais para todo mundo no mesmo dia e não guarda progresso.'
  ].forEach(text => rules.appendChild(el('li', null, text)));
  root.appendChild(rules);

  root.appendChild(el('h3', 'guide-title', `Recordes · ${DIFFICULTY[settings.difficulty].label}`));
  const list = el('div', 'records');
  for (const [key, mode] of Object.entries(modes)) {
    const record = records[key] || { score: 0, level: 0, streak: 0 };
    const row = el('div', 'record');
    row.appendChild(el('span', null, mode.label));
    row.appendChild(el('b', null, `${record.score} pts · fase ${record.level} · ${record.streak} seguidas`));
    list.appendChild(row);
  }
  root.appendChild(list);

  return root;
}
