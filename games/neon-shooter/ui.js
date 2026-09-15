import { DIFFICULTIES, DIFFICULTY_KEYS, ICONS, POWERUPS, UPGRADES, ENEMIES, ENEMY_DESCRIPTIONS, WAVES } from './config.js';
import { ACHIEVEMENTS, achievementProgress } from './progress.js';
import { PALETTE_OPTIONS } from '../../core/theme.js';

// Início, pausa e fim de jogo usam o painel do shell, como os outros jogos.
// Aqui ficam só a camada de melhorias (é jogabilidade, não menu) e o diálogo
// "Ajustes & bônus", montado com os mesmos componentes da biblioteca.

const fmt = n => Math.round(n || 0).toLocaleString('pt-BR');
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.star}"/></svg>`;
const ICON_COLORS = {
  power: '#ff5a5a', rapid: '#e8b923', bigshot: '#2fb8d6', double: '#ff9b3d', triple: '#ff7ab8', pierce: '#a47bff',
  crit: '#e0a82e', speed: '#6f8fe8', heal: '#35c47a', shield: '#3cb6e0', magnet: '#8fd13f', time: '#a47bff'
};

export function duration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

export function createUpgradeLayer(arena, onPick) {
  const layer = document.createElement('div');
  layer.className = 'overlay sh-upgrade';
  layer.hidden = true;
  arena.append(layer);
  let timer = 0;

  layer.addEventListener('click', event => {
    const card = event.target.closest('[data-upgrade]');
    if (card && !card.disabled) onPick(card.dataset.upgrade);
  });
  // O toque nos cartões não pode virar movimento da nave.
  layer.addEventListener('pointerdown', event => event.stopPropagation());

  return {
    show({ level, wave, options, levels }) {
      clearTimeout(timer);
      layer.innerHTML = `<div class="panel" role="group" aria-labelledby="shUpgradeTitle">
        <div class="eyebrow">Onda ${wave} concluída · nível ${level}</div>
        <h2 id="shUpgradeTitle">Escolha uma melhoria</h2>
        <div class="sh-cards">${options.map((id, i) => {
          const def = UPGRADES[id], lvl = levels[id] || 0;
          const pips = def.max > 1 && def.max < 10
            ? `<span class="sh-pips" aria-label="nível ${lvl + 1} de ${def.max}">${Array.from({ length: def.max }, (_, k) =>
                `<i${k <= lvl ? ' class="on"' : ''}></i>`).join('')}</span>` : '';
          return `<button type="button" class="sh-card" data-upgrade="${id}" disabled style="--c:${ICON_COLORS[def.icon] || 'var(--accent)'}">
            <span class="sh-card-icon">${svg(def.icon)}</span>
            <span class="sh-card-text"><b>${def.name}</b><small>${def.desc}</small>${pips}</span>
            <kbd aria-hidden="true">${i + 1}</kbd>
          </button>`;
        }).join('')}</div>
      </div>`;
      layer.hidden = false;
      // Trava curta: o dedo que estava pilotando não escolhe um cartão sem querer.
      timer = setTimeout(() => {
        layer.querySelectorAll('.sh-card').forEach(card => { card.disabled = false; });
        layer.querySelector('.sh-card')?.focus({ preventScroll: true });
      }, 450);
    },
    unlock() { clearTimeout(timer); layer.querySelectorAll('.sh-card').forEach(card => { card.disabled = false; }); },
    hide() { clearTimeout(timer); layer.hidden = true; layer.innerHTML = ''; },
    destroy() { clearTimeout(timer); layer.remove(); }
  };
}

// ---------------------------------------------------------------- diálogo
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

function slider(label, value, min, max, step, format, onInput) {
  const row = el('div', 'slider-row');
  const out = el('span', 'sh-slider-value', format(value));
  const input = el('input');
  input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value;
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => { out.textContent = format(Number(input.value)); onInput(Number(input.value)); });
  row.append(input, out);
  return row;
}

const percent = v => `${Math.round(v * 100)}%`;

export function buildDialog({ settings, stats, unlocked, playing, masterOn, haptics, theme, onChange, onMaster }) {
  const root = el('div', 'sh-dialog');

  const note = el('p', 'guide-intro', DIFFICULTIES[settings.difficulty].note);
  root.append(fieldset(playing ? 'Dificuldade · vale na próxima partida' : 'Dificuldade',
    radios('sh-difficulty', DIFFICULTY_KEYS.map(k => [k, DIFFICULTIES[k].label]), settings.difficulty, v => {
      note.textContent = DIFFICULTIES[v].note;
      onChange('difficulty', v);
    })), note);

  root.append(fieldset('Aparência', radios('sh-theme', [['dark', 'Escuro'], ['light', 'Claro']], theme.mode, v => theme.setMode(v))));
  root.append(fieldset('Cor neon', radios('sh-palette', PALETTE_OPTIONS.map(o => [o.value, o.label]), theme.choice, v => theme.setChoice(v))));

  root.append(fieldset('Controle no toque', radios('sh-control', [['drag', 'Arrastar'], ['joystick', 'Joystick']],
    settings.control, v => onChange('control', v))));
  root.append(fieldset('Sensibilidade do arrasto',
    slider('Sensibilidade do arrasto', settings.sensitivity, 0.6, 2.2, 0.1, v => `${v.toFixed(1)}×`, v => onChange('sensitivity', v))));
  root.append(fieldset('Efeitos visuais', radios('sh-effects', [['full', 'Completos'], ['low', 'Reduzidos']],
    settings.effects, v => onChange('effects', v))));

  const prefs = fieldset('Preferências');
  prefs.append(toggle('Tiro automático', 'Dispara sozinho quando há inimigos. Desligado: segure o dedo, o clique ou a barra de espaço.',
    settings.autofire, v => onChange('autofire', v)));
  prefs.append(toggle('Tremor de tela', 'Sacode a tela em explosões grandes e ao levar dano.', settings.shake, v => onChange('shake', v)));
  prefs.append(toggle('Vibração', haptics.supported ? 'Retorno tátil ao levar dano e em explosões grandes.' : 'Não disponível neste aparelho.',
    haptics.enabled, v => haptics.setEnabled(v), !haptics.supported));
  prefs.append(toggle('Som', 'Mesmo botão de som do topo da tela.', masterOn, onMaster));
  prefs.append(toggle('Efeitos sonoros', 'Tiros, explosões e power-ups.', settings.sfx, v => onChange('sfx', v)));
  prefs.append(slider('Volume dos efeitos', settings.sfxVolume, 0, 1, 0.05, percent, v => onChange('sfxVolume', v)));
  prefs.append(toggle('Música', 'Trilha synthwave gerada no aparelho.', settings.music, v => onChange('music', v)));
  prefs.append(slider('Volume da música', settings.musicVolume, 0, 1, 0.05, percent, v => onChange('musicVolume', v)));
  root.append(prefs);

  root.append(el('h3', 'guide-title', 'Power-ups'));
  root.append(el('p', 'guide-intro', 'Inimigos derrubados às vezes soltam cápsulas. O ícone com o tempo restante aparece no canto da arena.'));
  const powers = el('div', 'guide-grid');
  for (const [key, def] of Object.entries(POWERUPS)) {
    powers.append(el('div', 'guide-item sh-guide', `<span class="sh-guide-icon" style="--c:${def.color}">${svg(key)}</span>
      <div><strong>${def.name}</strong><p>${def.desc}</p></div>`));
  }
  root.append(powers);

  root.append(el('h3', 'guide-title', 'Inimigos'));
  const foes = el('div', 'guide-grid');
  for (const [key, def] of Object.entries(ENEMIES)) {
    foes.append(el('div', 'guide-item sh-guide', `<span class="sh-dot" style="--c:${def.color}"></span>
      <div><strong>${def.name} · ${def.role}</strong><p>${ENEMY_DESCRIPTIONS[key]}</p></div>`));
  }
  root.append(foes);
  root.append(el('p', 'guide-tip', `A cada ${WAVES.bossEvery} ondas surge um chefe com três fases, e todo ataque dele é anunciado: anel branco antes dos tiros, faixa vermelha antes da investida e faixa verde marcando a passagem na cortina. A barra verde no topo enche com os abates; a melhoria é escolhida no intervalo entre ondas. Abates sem levar dano sobem o combo, e a cada 10 os pontos valem mais.`));

  root.append(el('h3', 'guide-title', 'Recordes'));
  const records = el('div', 'records');
  const row = (label, value) => records.append(el('div', 'record', `<span>${label}</span><b>${value}</b>`));
  for (const key of DIFFICULTY_KEYS) {
    const best = stats.best[key];
    row(DIFFICULTIES[key].label, best.score ? `${fmt(best.score)} pts · onda ${best.wave}` : '—');
  }
  row('Partidas', fmt(stats.games));
  row('Inimigos destruídos', fmt(stats.kills));
  row('Chefes derrotados', fmt(stats.bosses));
  row('Maior combo', `x${fmt(stats.bestCombo)}`);
  row('Tempo de jogo', duration(stats.time));
  root.append(records);

  const done = ACHIEVEMENTS.filter(a => unlocked[a.id]).length;
  root.append(el('h3', 'guide-title', `Conquistas · ${done}/${ACHIEVEMENTS.length}`));
  const list = el('div', 'sh-achievements');
  for (const def of ACHIEVEMENTS) {
    const { value, goal, ratio } = achievementProgress(stats, def);
    const date = unlocked[def.id] ? new Date(unlocked[def.id]).toLocaleDateString('pt-BR') : '';
    list.append(el('div', `sh-achievement${date ? ' done' : ''}`, `
      <span class="sh-achievement-icon">${svg(def.icon)}</span>
      <div><strong>${def.name}</strong><p>${def.desc}</p>
        <div class="sh-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${value}"
          aria-label="${def.name}"><i style="width:${Math.round(ratio * 100)}%"></i></div></div>
      <small>${date || `${fmt(value)}/${fmt(goal)}`}</small>`));
  }
  root.append(list);
  return root;
}
