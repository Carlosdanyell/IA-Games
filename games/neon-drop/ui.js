import { PALETTE_OPTIONS } from '../../core/theme.js';
import { LEVELS, MODES } from './config.js';

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

export function buildDialog({ settings, theme, audio, haptics, progress, stages,
                              recordFor, onMode, onLevel, onFirst, onStages }) {
  const root = el('div');

  root.appendChild(radioGroup('Modo', 'drop-mode',
    Object.entries(MODES).map(([key, m]) => [key, m.label]), settings.mode, onMode));

  const nota = el('p', 'panel-note');
  const aplicar = value => { nota.textContent = LEVELS[value].note; };
  root.appendChild(radioGroup('Dificuldade da máquina', 'drop-level',
    Object.entries(LEVELS).map(([key, l]) => [key, l.label]), settings.level,
    value => { aplicar(value); onLevel(value); }));
  aplicar(settings.level);
  root.appendChild(nota);

  root.appendChild(radioGroup('Quem começa', 'drop-first',
    [['voce', 'Você'], ['ia', 'A máquina']], settings.first, onFirst));

  const escolher = el('button', 'ghost-button', 'Escolher fase');
  escolher.type = 'button';
  escolher.addEventListener('click', onStages);
  root.appendChild(escolher);

  root.appendChild(radioGroup('Aparência', 'theme', [['dark', 'Escuro'], ['light', 'Claro']],
    theme.mode, value => theme.setMode(value)));
  root.appendChild(radioGroup('Cor neon', 'palette',
    PALETTE_OPTIONS.map(o => [o.value, o.label]), theme.choice, value => theme.setChoice(value)));

  const prefs = el('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Preferências';
  prefs.appendChild(legend);
  prefs.appendChild(switchRow('Som', 'Queda da peça, vitória e derrota.',
    audio.enabled, value => audio.setEnabled(value)));
  prefs.appendChild(switchRow('Vibração',
    haptics.supported ? 'Retorno tátil quando a peça assenta.' : 'Não disponível neste aparelho.',
    haptics.enabled, value => haptics.setEnabled(value), !haptics.supported));
  root.appendChild(prefs);

  root.appendChild(el('h3', 'guide-title', 'Como jogar'));
  const how = el('ul');
  [
    'Encoste o dedo no tabuleiro e arraste: a peça acompanha a coluna e a sombra mostra onde ela vai parar. Solte para jogar.',
    'De quem é a vez está escrito no alto do tabuleiro, com a peça da cor de quem joga ao lado.',
    'As peças são âmbar e ciano. Além da cor, a âmbar é um anel e a ciano tem o miolo cheio — dá para separar as duas sem depender de enxergar cor.',
    'Vence quem alinhar a quantidade pedida pela fase — quatro na maioria, cinco nas grandes — na horizontal, na vertical ou na diagonal.',
    'No teclado: setas escolhem a coluna, 1–9 jogam direto na coluna e espaço solta a peça.',
    'Os blocos riscados não recebem peça: o que fica embaixo deles é espaço morto e nenhuma linha passa por ali.',
    'O círculo branco marca a última peça que caiu, para achar de relance onde o oponente jogou.'
  ].forEach(text => how.appendChild(el('li', null, text)));
  root.appendChild(how);

  root.appendChild(el('h3', 'guide-title', 'Fases'));
  const lista = el('div', 'records');
  stages.forEach((stage, index) => {
    const liberada = settings.mode !== 'campanha' || index < progress.unlocked;
    const rec = recordFor(index);
    const row = el('div', 'record');
    row.appendChild(el('span', null, `${index + 1}. ${liberada ? stage.name : '???'}`));
    row.appendChild(el('b', null, liberada
      ? `${stage.cols}×${stage.rows} · conecta ${stage.connect} · ${rec.wins}V ${rec.losses}D`
      : 'bloqueada'));
    lista.appendChild(row);
  });
  root.appendChild(lista);
  root.appendChild(el('p', 'panel-note', `Pontuação acumulada: ${progress.score}. Vencer fases adiante e em dificuldade maior vale mais.`));

  return root;
}
