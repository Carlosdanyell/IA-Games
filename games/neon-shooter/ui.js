import { DIFFICULTIES, DIFFICULTY_KEYS, ICONS, POWERUPS, UPGRADES, ENEMIES, ENEMY_DESCRIPTIONS, WAVES } from './config.js';
import { ACHIEVEMENTS, achievementProgress } from './progress.js';

// Telas em DOM por cima do canvas (menu, pausa, melhorias, fim de jogo) e o
// conteúdo dos diálogos de configurações e conquistas. Botões grandes, um por
// linha no retrato: nada de alvo pequeno para o dedo.

const fmt = n => Math.round(n || 0).toLocaleString('pt-BR');
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.star}"/></svg>`;
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true" class="ns-fill"><path d="m8 5 11 7-11 7z"/></svg>';
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>';
const ICON_COLORS = {
  power: '#ff5a5a', rapid: '#ffe45e', bigshot: '#5ff4ff', double: '#ff9b3d', triple: '#ff7ab8', pierce: '#c6a2ff',
  crit: '#ffd166', speed: '#7aa8ff', heal: '#6dff9e', shield: '#5fd5ff', magnet: '#b6ff5f', time: '#a47bff'
};

export function duration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`;
  return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

export function createScreens(arena, handlers) {
  const root = document.createElement('div');
  root.className = 'ns-screens';
  arena.append(root);
  let current = '', unlockTimer = 0;

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled || !root.contains(button)) return;
    handlers.action(button.dataset.action, button.dataset.value);
  });
  // Evita que toque nas telas vire movimento da nave ou zoom.
  root.addEventListener('pointerdown', event => event.stopPropagation());

  function show(name, html, focus = true) {
    clearTimeout(unlockTimer);
    current = name;
    root.hidden = false;
    root.innerHTML = html;
    root.dataset.screen = name;
    if (focus) requestAnimationFrame(() => root.querySelector('[data-focus]')?.focus({ preventScroll: true }));
  }

  const miniStats = items => `<div class="ns-mini-stats">${items.map(([label, value]) =>
    `<div><small>${label}</small><b>${value}</b></div>`).join('')}</div>`;

  return {
    get current() { return current; },
    hide() { clearTimeout(unlockTimer); current = ''; root.hidden = true; root.innerHTML = ''; },

    showMenu({ difficulty, best, unlocked, hint }) {
      const d = DIFFICULTIES[difficulty];
      show('menu', `
        <section class="ns-screen ns-menu" aria-labelledby="nsMenuTitle">
          <h2 class="ns-logo" id="nsMenuTitle"><span>NEON</span><b>SHOOTER</b></h2>
          <p class="ns-tagline">Sobreviva às ondas. Derrote os chefes.</p>
          ${miniStats([['Recorde', best.score ? fmt(best.score) : '—'], ['Maior onda', best.wave || '—']])}
          <div class="ns-difficulty" role="radiogroup" aria-label="Dificuldade">
            ${DIFFICULTY_KEYS.map(key => `<button type="button" role="radio" aria-checked="${key === difficulty}"
              data-action="difficulty" data-value="${key}">${DIFFICULTIES[key].label}</button>`).join('')}
          </div>
          <p class="ns-note">${d.note}</p>
          <button type="button" class="ns-play" data-action="play" data-focus>${PLAY}<span>Jogar</span></button>
          <div class="ns-row">
            <button type="button" class="ns-ghost" data-action="settings">${GEAR}<span>Configurações</span></button>
            <button type="button" class="ns-ghost" data-action="achievements">${svg('trophy')}<span>Conquistas <em>${unlocked}/${ACHIEVEMENTS.length}</em></span></button>
          </div>
          <p class="ns-hint">${hint}</p>
        </section>`);
    },

    showPause({ wave, score, kills, level }) {
      show('pause', `
        <section class="ns-screen ns-pause" aria-labelledby="nsPauseTitle">
          <p class="ns-eyebrow">Jogo pausado</p>
          <h2 id="nsPauseTitle">Onda ${wave}</h2>
          ${miniStats([['Pontos', fmt(score)], ['Abates', fmt(kills)], ['Nível', level]])}
          <button type="button" class="ns-play" data-action="resume" data-focus>${PLAY}<span>Continuar</span></button>
          <div class="ns-stack">
            <button type="button" class="ns-ghost" data-action="restart">Reiniciar partida</button>
            <button type="button" class="ns-ghost" data-action="settings">${GEAR}<span>Configurações</span></button>
            <button type="button" class="ns-ghost" data-action="menu">Voltar ao menu</button>
          </div>
        </section>`);
    },

    showUpgrade({ level, options, levels }) {
      show('upgrade', `
        <section class="ns-screen ns-upgrade" aria-labelledby="nsUpTitle">
          <p class="ns-eyebrow">Nível ${level}</p>
          <h2 id="nsUpTitle">Escolha uma melhoria</h2>
          <div class="ns-cards">
            ${options.map((id, i) => {
              const def = UPGRADES[id], lvl = levels[id] || 0;
              const pips = def.max > 1 && def.max < 10
                ? `<span class="ns-pips" aria-label="nível ${lvl + 1} de ${def.max}">${Array.from({ length: def.max }, (_, k) =>
                    `<i${k <= lvl ? ' class="on"' : ''}></i>`).join('')}</span>` : '';
              return `<button type="button" class="ns-card" data-action="pick" data-value="${id}" disabled
                style="--c:${ICON_COLORS[def.icon] || '#5ff4ff'}" ${i === 0 ? 'data-focus' : ''}>
                <span class="ns-card-icon">${svg(def.icon)}</span>
                <span class="ns-card-text"><b>${def.name}</b><small>${def.desc}</small>${pips}</span>
                <kbd aria-hidden="true">${i + 1}</kbd>
              </button>`;
            }).join('')}
          </div>
        </section>`, false);
      // Trava curta: o dedo que estava pilotando não escolhe um cartão sem querer.
      unlockTimer = setTimeout(() => {
        root.querySelectorAll('.ns-card').forEach(card => { card.disabled = false; });
        root.querySelector('[data-focus]')?.focus({ preventScroll: true });
      }, 450);
    },

    showOver({ score, wave, kills, maxCombo, bosses, time, record, unlocked }) {
      show('over', `
        <section class="ns-screen ns-over" aria-labelledby="nsOverTitle">
          <p class="ns-eyebrow ns-warn">Nave destruída</p>
          <h2 id="nsOverTitle">Fim de jogo</h2>
          <div class="ns-final"><small>Pontuação</small><b>${fmt(score)}</b>
            ${record.score ? '<span class="ns-badge">Novo recorde!</span>' : record.wave ? '<span class="ns-badge">Maior onda!</span>' : ''}</div>
          ${miniStats([['Onda', wave], ['Abates', fmt(kills)], ['Combo máx.', `x${maxCombo}`]])}
          ${miniStats([['Chefes', bosses], ['Tempo', duration(time)]])}
          ${unlocked.length ? `<div class="ns-unlocked"><small>Conquistas nesta partida</small>
            ${unlocked.map(a => `<span>${svg(a.icon)}${a.name}</span>`).join('')}</div>` : ''}
          <button type="button" class="ns-play" data-action="restart" data-focus>${PLAY}<span>Jogar de novo</span></button>
          <button type="button" class="ns-ghost" data-action="menu">Menu</button>
        </section>`);
    },

    enableCards() {
      clearTimeout(unlockTimer);
      root.querySelectorAll('.ns-card').forEach(card => { card.disabled = false; });
    },
    destroy() { clearTimeout(unlockTimer); root.remove(); }
  };
}

// ---------------------------------------------------------------- diálogos
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
  const out = el('span', 'ns-slider-value', format(value));
  const input = el('input');
  input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = value;
  input.setAttribute('aria-label', label);
  input.addEventListener('input', () => { out.textContent = format(Number(input.value)); onInput(Number(input.value)); });
  row.append(input, out);
  return row;
}

const percent = v => `${Math.round(v * 100)}%`;

export function buildSettings({ settings, masterOn, haptics, theme, onChange, onMaster }) {
  const root = el('div', 'ns-dialog');
  root.append(fieldset('Controle no toque', radios('ns-control', [['drag', 'Arrastar'], ['joystick', 'Joystick']],
    settings.control, v => onChange('control', v))));
  root.append(el('p', 'guide-intro', 'Arrastar: deslize em qualquer lugar e a nave acompanha o dedo, sem ficar embaixo dele. Joystick: toque para criar o controle onde estiver o polegar.'));
  root.append(fieldset('Sensibilidade do arrasto',
    slider('Sensibilidade do arrasto', settings.sensitivity, 0.6, 2.2, 0.1, v => `${v.toFixed(1)}×`, v => onChange('sensitivity', v))));

  const play = fieldset('Partida');
  play.append(toggle('Tiro automático', 'Dispara sozinho quando há inimigos na tela. Desligado: segure o dedo, o clique ou a barra de espaço.',
    settings.autofire, v => onChange('autofire', v)));
  play.append(toggle('Vibração', haptics.supported ? 'Retorno tátil ao levar dano e em explosões grandes.' : 'Não disponível neste aparelho.',
    haptics.enabled, v => haptics.setEnabled(v), !haptics.supported));
  root.append(play);

  const sound = fieldset('Som');
  sound.append(toggle('Som ligado', 'Mesmo botão de som do topo da tela.', masterOn, onMaster));
  sound.append(toggle('Efeitos sonoros', 'Tiros, explosões, power-ups e avisos.', settings.sfx, v => onChange('sfx', v)));
  sound.append(slider('Volume dos efeitos', settings.sfxVolume, 0, 1, 0.05, percent, v => onChange('sfxVolume', v)));
  sound.append(toggle('Música', 'Trilha synthwave gerada no aparelho.', settings.music, v => onChange('music', v)));
  sound.append(slider('Volume da música', settings.musicVolume, 0, 1, 0.05, percent, v => onChange('musicVolume', v)));
  root.append(sound);

  root.append(fieldset('Efeitos visuais', radios('ns-effects', [['full', 'Completos'], ['low', 'Reduzidos']],
    settings.effects, v => onChange('effects', v))));
  root.append(el('p', 'guide-intro', 'Reduzidos: menos partículas, estrelas e brilho. Use em aparelhos mais simples.'));
  root.append(toggle('Tremor de tela', 'Sacode a tela em explosões grandes e ao levar dano.', settings.shake, v => onChange('shake', v)));
  root.append(fieldset('Interface', radios('ns-theme', [['dark', 'Escura'], ['light', 'Clara']], theme.mode, v => theme.setMode(v))));

  root.append(el('h3', 'guide-title', 'Power-ups'));
  const powers = el('div', 'guide-grid');
  for (const [key, def] of Object.entries(POWERUPS)) {
    powers.append(el('div', 'guide-item ns-guide', `<span class="ns-guide-icon" style="--c:${def.color}">${svg(key)}</span>
      <div><strong>${def.name}</strong><p>${def.desc}</p></div>`));
  }
  root.append(powers);

  root.append(el('h3', 'guide-title', 'Inimigos'));
  const foes = el('div', 'guide-grid');
  for (const [key, def] of Object.entries(ENEMIES)) {
    foes.append(el('div', 'guide-item ns-guide', `<span class="ns-dot" style="--c:${def.color}"></span>
      <div><strong>${def.name} · ${def.role}</strong><p>${ENEMY_DESCRIPTIONS[key]}</p></div>`));
  }
  root.append(foes);
  root.append(el('p', 'guide-tip', `A cada ${WAVES.bossEvery} ondas surge um chefe com três fases. Todo ataque dele é anunciado: anel branco antes dos tiros, faixa vermelha antes da investida e faixa verde marcando a passagem segura na cortina. Abates sem levar dano sobem o combo, e a cada 10 o multiplicador de pontos aumenta.`));
  return root;
}

export function buildAchievements({ unlocked, stats }) {
  const root = el('div', 'ns-dialog');
  const done = ACHIEVEMENTS.filter(a => unlocked[a.id]).length;
  root.append(el('p', 'guide-intro', `${done} de ${ACHIEVEMENTS.length} conquistas desbloqueadas.`));
  const list = el('div', 'ns-achievements');
  for (const def of ACHIEVEMENTS) {
    const { value, goal, ratio } = achievementProgress(stats, def);
    const date = unlocked[def.id] ? new Date(unlocked[def.id]).toLocaleDateString('pt-BR') : '';
    list.append(el('div', `ns-achievement${date ? ' done' : ''}`, `
      <span class="ns-achievement-icon">${svg(def.icon)}</span>
      <div><strong>${def.name}</strong><p>${def.desc}</p>
        <div class="ns-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${value}"
          aria-label="${def.name}"><i style="width:${Math.round(ratio * 100)}%"></i></div></div>
      <small>${date || `${fmt(value)}/${fmt(goal)}`}</small>`));
  }
  root.append(list);

  root.append(el('h3', 'guide-title', 'Estatísticas'));
  const records = el('div', 'records');
  const row = (label, value) => records.append(el('div', 'record', `<span>${label}</span><b>${value}</b>`));
  row('Partidas', fmt(stats.games));
  row('Inimigos destruídos', fmt(stats.kills));
  row('Chefes derrotados', fmt(stats.bosses));
  row('Power-ups coletados', fmt(stats.powerups));
  row('Ondas sem dano', fmt(stats.flawless));
  row('Maior combo', `x${fmt(stats.bestCombo)}`);
  row('Tempo de jogo', duration(stats.time));
  for (const key of DIFFICULTY_KEYS) {
    const best = stats.best[key];
    row(`Recorde · ${DIFFICULTIES[key].label}`, best.score ? `${fmt(best.score)} pts · onda ${best.wave}` : '—');
  }
  root.append(records);
  return root;
}
