import { MODES, DIFFICULTIES, MAPS, ITEMS, ACHIEVEMENTS } from './config.js';
import { PALETTE_OPTIONS } from '../../core/theme.js';

// Diálogo "Ajustes & bônus", montado com os componentes do shell como nos
// outros jogos: modo, dificuldade, arenas, aparência, som, guia e progresso.

const number = n => Number(n || 0).toLocaleString('pt-BR');
const time = seconds => {
  const s = Math.floor(seconds || 0), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`;
};
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
};

function fieldset(legend, ...content) {
  const fs = el('fieldset');
  fs.append(el('legend', null, legend), ...content);
  return fs;
}

function radios(name, options, current, onChange) {
  const wrap = el('div', 'choices');
  for (const [value, label] of options) {
    const choice = el('label', 'choice');
    const input = el('input');
    input.type = 'radio'; input.name = name; input.value = value; input.checked = value === current;
    input.addEventListener('change', () => onChange(value));
    choice.append(input, el('span', null, label));
    wrap.append(choice);
  }
  return wrap;
}

function toggle(title, description, checked, onChange, disabled = false) {
  const row = el('div', 'switch-row');
  const text = el('div');
  text.append(el('strong', null, title), el('p', null, description));
  const box = el('label', 'switch');
  const input = el('input');
  input.type = 'checkbox'; input.checked = checked; input.disabled = disabled;
  input.setAttribute('aria-label', title);
  input.addEventListener('change', () => onChange(input.checked));
  box.append(input, el('i'));
  row.append(text, box);
  return row;
}

export function buildDialog({ profile, playing, theme, haptics, masterOn, onSetting, onMaster }) {
  const s = profile.settings;
  const later = playing ? ' · vale na próxima partida' : '';
  const root = el('div', 'ns-dialog');

  const modeNote = el('p', 'guide-intro', MODES.find(m => m.id === s.mode).description);
  root.append(fieldset(`Modo${later}`, radios('ns-mode', MODES.map(m => [m.id, m.name]), s.mode, v => {
    modeNote.textContent = MODES.find(m => m.id === v).description;
    onSetting('mode', v);
  })), modeNote);

  const diffNote = el('p', 'guide-intro', DIFFICULTIES.find(d => d.id === s.difficulty).description);
  root.append(fieldset(`Dificuldade${later}`, radios('ns-difficulty', DIFFICULTIES.map(d => [d.id, d.name]), s.difficulty, v => {
    diffNote.textContent = DIFFICULTIES.find(d => d.id === v).description;
    onSetting('difficulty', v);
  })), diffNote);

  const arenas = el('div', 'ns-arenas');
  const buttons = MAPS.map((map, i) => {
    const open = profile.unlockedMaps.includes(map.id);
    const button = el('button', 'level-pick', `${String(i + 1).padStart(2, '0')}<b>${map.name}</b><i>${open ? (s.map === map.id ? '✓' : 'livre') : `${number(profile.stats.foods)}/${map.unlock}`}</i>`);
    button.type = 'button';
    button.disabled = !open;
    button.style.setProperty('--c', map.color);
    if (s.map === map.id) button.setAttribute('aria-current', 'step');
    button.setAttribute('aria-label', `${map.name}: ${open ? map.description : `libera com ${map.unlock} alimentos`}`);
    button.addEventListener('click', () => {
      for (const other of buttons) {
        other.removeAttribute('aria-current');
        if (!other.disabled) other.querySelector('i').textContent = 'livre';
      }
      button.setAttribute('aria-current', 'step');
      button.querySelector('i').textContent = '✓';
      onSetting('map', map.id);
    });
    arenas.append(button);
    return button;
  });
  root.append(fieldset(`Arena${later}`, arenas));
  root.append(el('p', 'guide-intro', 'Alimentos coletados em qualquer modo liberam arenas novas. Os obstáculos de cada arena aparecem no modo Desafio.'));

  root.append(fieldset('Aparência', radios('ns-theme', [['dark', 'Escuro'], ['light', 'Claro']], theme.mode, v => theme.setMode(v))));
  root.append(fieldset('Cor neon', radios('ns-palette', PALETTE_OPTIONS.map(o => [o.value, o.label]), theme.choice, v => theme.setChoice(v))));

  const prefs = fieldset('Preferências');
  prefs.append(toggle('Som', 'Mesmo botão de som do topo da tela.', masterOn, onMaster));
  prefs.append(toggle('Efeitos sonoros', 'Coletas, combos, bônus e colisões.', s.effects, v => onSetting('effects', v)));
  prefs.append(toggle('Música', 'Trilha eletrônica gerada no aparelho.', s.music, v => onSetting('music', v)));
  prefs.append(toggle('Vibração', haptics.supported ? 'Retorno breve ao comer e ao usar o escudo.' : 'Não disponível neste aparelho.',
    haptics.enabled, v => haptics.setEnabled(v), !haptics.supported));
  prefs.append(toggle('Reduzir efeitos visuais', 'Menos partículas, rastro e animações.', s.reducedMotion, v => onSetting('reducedMotion', v)));
  root.append(prefs);

  root.append(el('h3', 'guide-title', 'Como jogar'));
  root.append(el('p', 'guide-intro', 'Arraste em qualquer lugar da arena: a cobra vira suavemente para a direção do dedo, e a seta na frente da cabeça mostra o rumo. Soltar o dedo mantém a direção. No computador, a cobra segue o mouse, ou use as setas e WASD; Espaço ou P pausa. Coma em até 5 segundos seguidos para subir o combo.'));

  root.append(el('h3', 'guide-title', 'Itens'));
  const items = el('div', 'guide-grid');
  for (const item of Object.values(ITEMS)) {
    items.append(el('div', 'guide-item', `<span class="ns-item-icon" style="--c:${item.color}">${item.symbol}</span>
      <div><strong>${item.name}</strong><p>${item.description}</p></div>`));
  }
  root.append(items);

  root.append(el('h3', 'guide-title', 'Recordes'));
  const records = el('div', 'records');
  const row = (label, value) => records.append(el('div', 'record', `<span>${label}</span><b>${value}</b>`));
  row('Maior pontuação', number(profile.best));
  for (const mode of MODES) row(mode.name, number(profile.bestByMode[mode.id]));
  for (const difficulty of DIFFICULTIES) row(difficulty.name, number(profile.bestByDifficulty[difficulty.id]));
  row('Partidas', number(profile.stats.games));
  row('Maior tamanho', number(profile.stats.maxLength));
  row('Melhor combo', `×${profile.stats.bestCombo}`);
  row('Alimentos', number(profile.stats.foods));
  row('Tempo jogado', time(profile.stats.time));
  root.append(records);

  root.append(el('h3', 'guide-title', `Conquistas · ${profile.achievements.length}/${ACHIEVEMENTS.length}`));
  const list = el('div', 'ns-achievements');
  for (const achievement of ACHIEVEMENTS) {
    const done = profile.achievements.includes(achievement.id);
    list.append(el('div', `ns-achievement${done ? ' done' : ''}`,
      `${done ? CHECK : LOCK}<div><strong>${achievement.name}</strong><p>${achievement.description}</p></div>`));
  }
  root.append(list);
  return root;
}
