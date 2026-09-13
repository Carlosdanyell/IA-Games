import { POWERS, GUIDE_BRICKS } from './content.js';
import { PALETTE_OPTIONS } from '../../core/theme.js';
import { PHASES } from './levels.js';

// Conteúdo do diálogo de ajustes. Fica separado do laço de jogo de propósito:
// é DOM puro, criado sob demanda e descartado ao fechar.
const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
};

function radioGroup(name, options, current, onChange) {
  const wrap = el('div', 'choices');
  for (const opt of options) {
    const label = el('label', 'choice');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = opt.value;
    input.checked = opt.value === current;
    input.addEventListener('change', () => onChange(opt.value));
    label.appendChild(input);
    label.appendChild(el('span', null, opt.label));
    wrap.appendChild(label);
  }
  return wrap;
}

function fieldset(legend, content) {
  const fs = el('fieldset');
  const lg = document.createElement('legend');
  lg.textContent = legend;
  fs.appendChild(lg);
  fs.appendChild(content);
  return fs;
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
  box.appendChild(input);
  box.appendChild(document.createElement('i'));
  row.appendChild(left);
  row.appendChild(box);
  return row;
}

function sliderRow(label, value, min, max, step, onInput) {
  const row = el('div', 'slider-row');
  const out = el('span', null, Math.round(value * 100) + '%');
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min; input.max = max; input.step = step; input.value = value;
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => {
    out.textContent = Math.round(input.value * 100) + '%';
    onInput(Number(input.value));
  });
  row.appendChild(input);
  row.appendChild(out);
  return row;
}

function guideGrid(items) {
  const grid = el('div', 'guide-grid');
  for (const item of items) {
    const card = el('div', 'guide-item');
    if (item.bad) card.dataset.tone = 'warn';
    card.appendChild(el('span', 'guide-icon', item.symbol));
    const body = el('div');
    body.appendChild(el('strong', null, item.name));
    body.appendChild(el('p', null, item.desc));
    card.appendChild(body);
    grid.appendChild(card);
  }
  return grid;
}

export function buildDialog(opts) {
  const { settings, theme, audio, haptics, mode, records,
          onMode, onControl, onAssist, onEffects, onSensitivity } = opts;
  const root = el('div');

  root.appendChild(fieldset('Modo de jogo', radioGroup('mode', [
    { value: 'campaign', label: 'Campanha' },
    { value: 'endless', label: 'Infinito' },
    { value: 'daily', label: 'Diário' }
  ], mode, onMode)));

  root.appendChild(fieldset('Aparência', radioGroup('theme', [
    { value: 'dark', label: 'Escuro' },
    { value: 'light', label: 'Claro' }
  ], theme.mode, v => theme.setMode(v))));

  // A lista vem de core/theme.js: acrescentar uma cor lá aparece nos dois jogos.
  root.appendChild(fieldset('Cor neon',
    radioGroup('palette', PALETTE_OPTIONS, theme.choice, v => theme.setChoice(v))));

  root.appendChild(fieldset('Controle', radioGroup('control', [
    { value: 'absolute', label: 'Toque direto' },
    { value: 'relative', label: 'Arrasto' }
  ], settings.control, onControl)));

  const sens = fieldset('Sensibilidade do arrasto',
    sliderRow('Sensibilidade', settings.sensitivity / 3, 0.2, 1, 0.05, v => onSensitivity(v * 3)));
  root.appendChild(sens);

  root.appendChild(fieldset('Efeitos visuais', radioGroup('effects', [
    { value: 'full', label: 'Completo' },
    { value: 'medium', label: 'Médio' },
    { value: 'low', label: 'Leve' }
  ], settings.effectsLevel, onEffects)));

  const fsMisc = el('fieldset');
  const lg = document.createElement('legend');
  lg.textContent = 'Preferências';
  fsMisc.appendChild(lg);
  fsMisc.appendChild(switchRow('Modo assistido',
    'Bolinha maior, plataforma maior e 15% mais devagar.', settings.assist, onAssist));
  fsMisc.appendChild(switchRow('Vibração',
    haptics.supported ? 'Retorno tátil ao quebrar blocos.' : 'Não disponível neste aparelho.',
    haptics.enabled, v => haptics.setEnabled(v), !haptics.supported));
  fsMisc.appendChild(switchRow('Som', 'Efeitos sonoros sintetizados.',
    audio.enabled, v => audio.setEnabled(v)));
  const volume = el('div');
  volume.style.paddingTop = '10px';
  volume.appendChild(el('strong', null, 'Volume'));
  volume.appendChild(sliderRow('Volume', audio.volume, 0, 1, 0.05, v => audio.setVolume(v)));
  fsMisc.appendChild(volume);
  root.appendChild(fsMisc);

  root.appendChild(el('h3', 'guide-title', 'Cápsulas'));
  root.appendChild(el('p', 'guide-intro',
    'Blocos com símbolo liberam uma cápsula ao quebrar. Capture com a plataforma — as vermelhas atrapalham.'));
  root.appendChild(guideGrid(Object.entries(POWERS)
    .map(([key, p]) => ({ symbol: p.symbol, name: p.name, desc: p.desc, bad: p.bad }))));

  root.appendChild(el('h3', 'guide-title', 'Tipos de bloco'));
  root.appendChild(guideGrid(GUIDE_BRICKS));

  root.appendChild(el('p', 'guide-tip',
    'Você só perde uma vida quando todas as bolinhas caem. Lento e turbo se substituem, assim como expansão e encolhimento. Pausar congela tudo. O ímã ⊂ segura a bola: onde ela encosta na plataforma define o ângulo de saída.'));

  root.appendChild(el('h3', 'guide-title', 'Recordes'));
  const list = el('div', 'records');
  const rec = (label, data) => {
    const row = el('div', 'record');
    row.appendChild(el('span', null, label));
    row.appendChild(el('b', null, `${data.score.toLocaleString('pt-BR')} pts · fase ${data.level || 0}`));
    return row;
  };
  list.appendChild(rec('Campanha', records.campaign));
  list.appendChild(rec('Infinito', records.endless));
  list.appendChild(rec('Diário', records.daily));
  const stars = Object.values(records.stars || {}).reduce((a, b) => a + b, 0);
  const starRow = el('div', 'record');
  starRow.appendChild(el('span', null, 'Estrelas da campanha'));
  starRow.appendChild(el('b', null, `${stars} / ${PHASES.length * 3}`));
  list.appendChild(starRow);
  root.appendChild(list);

  return root;
}
