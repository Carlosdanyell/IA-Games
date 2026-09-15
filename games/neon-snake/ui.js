import { MODES, DIFFICULTIES, MAPS, ITEMS, ACHIEVEMENTS } from './config.js';

const paths = {
  play: '<path d="m9 5 11 7-11 7z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  trophy: '<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 0h8"/>',
  sliders: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  chart: '<path d="M5 20V10m7 10V4m7 16v-7"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16m-10-6v16"/>',
  wrap: '<path d="M8 6H5a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h3m8-12h3a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3M7 12h10m-3-3 3 3-3 3"/>',
  challenge: '<path d="m12 3 10 18H2zM12 9v5m0 3v.1"/>',
  zen: '<path d="M12 20c-8-1-10-6-9-11 5 0 8 3 9 7 1-4 4-7 9-7 1 5-1 10-9 11zm0-4c-5-5-4-9 0-13 4 4 5 8 0 13z"/>',
  touch: '<path d="M9 12V6a2 2 0 0 1 4 0v5l3-1 4 3-2 8h-8l-6-8a2 2 0 0 1 3-2l2 1zM4 5 2 7l2 2m14-6 2 2-2 2"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
};
export const icon = (name, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
const number = n => Number(n || 0).toLocaleString('pt-BR');
const time = seconds => `${Math.floor(seconds / 60)} min ${Math.floor(seconds % 60)} s`;

function heroArt() {
  return `<svg class="ns-hero-art" viewBox="0 0 500 320" aria-hidden="true">
    <defs><pattern id="ns-grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0v25" fill="none" stroke="#b9ff66" stroke-opacity=".085" stroke-width="1"/></pattern>
      <linearGradient id="ns-body"><stop stop-color="#557c39"/><stop offset="1" stop-color="#c4ff78"/></linearGradient>
      <radialGradient id="ns-halo"><stop stop-color="#b9ff66" stop-opacity=".12"/><stop offset="1" stop-color="#b9ff66" stop-opacity="0"/></radialGradient>
      <filter id="ns-glow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="8"/></filter></defs>
    <ellipse cx="260" cy="155" rx="230" ry="160" fill="url(#ns-halo)"/>
    <rect x="25" y="10" width="450" height="285" fill="url(#ns-grid)"/>
    <path d="M65 248h92q18 0 18-18v-65q0-18 18-18h100q18 0 18-18V80q0-18 18-18h62" stroke="#b9ff66" stroke-width="30" opacity=".22" filter="url(#ns-glow)"/>
    <path d="M65 248h92q18 0 18-18v-65q0-18 18-18h100q18 0 18-18V80q0-18 18-18h62" fill="none" stroke="url(#ns-body)" stroke-width="23" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M65 244h91m26-78v52m24-76h79m34-40V84m19-27h26" stroke="#e2ffc5" stroke-opacity=".32" stroke-width="2"/>
    <rect x="368" y="48" width="34" height="29" rx="10" fill="#c8ff85"/>
    <rect x="387" y="53" width="5" height="5" rx="1.5" fill="#172512"/><rect x="387" y="66" width="5" height="5" rx="1.5" fill="#172512"/>
    <circle cx="389" cy="196" r="27" fill="#ff768d" opacity=".16"/><circle cx="389" cy="196" r="14" fill="#ff768d" opacity=".2" filter="url(#ns-glow)"/>
    <path d="m389 184 12 12-12 12-12-12z" fill="#ff8298"/><path d="m389 188 5 5" stroke="#ffe0e7" stroke-width="2"/>
    <g fill="#c8ff85"><circle cx="91" cy="90" r="2" opacity=".7"/><circle cx="237" cy="237" r="2" opacity=".4"/><circle cx="441" cy="132" r="2" opacity=".5"/></g>
    <g stroke="#7c925e" stroke-width="1"><path d="M25 32V10h22m406 0h22v22M25 273v22h22m406 0h22v-22"/></g>
    <text x="43" y="286" fill="#728267" font-family="monospace" font-size="8" letter-spacing="2">ARENA 01 / GRID NEON</text>
  </svg>`;
}

export function createUI(hud, { getProfile, onStart, onSetting, onOpen }) {
  const app = hud.arena.closest('.app');
  const home = document.createElement('section');
  home.className = 'ns-home';
  home.setAttribute('aria-label', 'Menu Neon Snake');
  app.querySelector('.topbar').after(home);
  const strip = document.createElement('div');
  strip.className = 'ns-arena-meta';
  hud.arena.before(strip);
  const controls = document.createElement('div');
  controls.className = 'ns-controls';
  controls.innerHTML = `<div class="ns-gesture-note">${icon('touch')}<span>Deslize para mudar de direção<small>Use toda esta área ou o tabuleiro</small></span></div>
    <div class="ns-dpad" hidden aria-label="Controles direcionais">${[['up','↑','Cima'],['left','←','Esquerda'],['down','↓','Baixo'],['right','→','Direita']].map(([dir, symbol, label]) => `<button type="button" data-direction="${dir}" aria-label="${label}">${symbol}</button>`).join('')}</div>`;
  hud.arena.after(controls);
  // Pontuação acima do botão e detalhes abaixo dele: "Jogar novamente" fica
  // visível sem rolar, mesmo em telas baixas.
  const result = document.createElement('div');
  result.className = 'ns-final-score'; result.hidden = true;
  hud.el.action.before(result);
  const details = document.createElement('div');
  details.className = 'ns-result-grid'; details.hidden = true;
  hud.el.secondary.after(details);
  hud.el.settings.textContent = 'Configurações';
  const menuTool = document.createElement('button');
  menuTool.className = 'icon-button ns-menu-settings'; menuTool.type = 'button';
  menuTool.setAttribute('aria-label', 'Configurações'); menuTool.innerHTML = icon('sliders');
  app.querySelector('.tools').append(menuTool);
  menuTool.addEventListener('click', () => showSettings());
  const modeIcon = { classic: 'grid', wrap: 'wrap', challenge: 'challenge', zen: 'zen' };
  const modeNote = {classic:'O clássico, com um novo brilho.',wrap:'Atravesse as bordas. Continue o fluxo.',challenge:'Obstáculos, perigos e novos objetivos.',zen:'Respire. Encontre o seu ritmo.'};

  function renderHome() {
    const p = getProfile(), s = p.settings;
    const map = MAPS.find(m => m.id === s.map) || MAPS[0];
    home.innerHTML = `<div class="ns-hero">
      <div class="ns-kicker"><span class="ns-live-dot"></span> O CLÁSSICO EM OUTRA FREQUÊNCIA</div>
      <h2>NEON<br><span>SNAKE<span class="ns-title-dot">.</span></span></h2>
      <p class="ns-lead">Siga o instinto. Encontre o ritmo.<br>Quanto longe você consegue chegar?</p>
      ${heroArt()}
      <div class="ns-personal-best">${icon('trophy')}<div><span>SEU MELHOR</span><strong>${number(p.best)} <small>pts</small></strong></div><span class="ns-best-line"></span><span class="ns-local-label">Seu próximo recorde<br>começa aqui.</span></div>
    </div>
    <div class="ns-setup">
      <div class="ns-setup-heading"><div class="ns-kicker">PRONTO PARA O PRÓXIMO NÍVEL?</div><h3>Sua próxima partida</h3></div>
      <fieldset><legend><span>01</span> Modo de jogo</legend><div class="ns-mode-grid">${MODES.map(m => `<button type="button" class="ns-mode" data-mode="${m.id}" aria-pressed="${s.mode === m.id}">${icon(modeIcon[m.id])}<span>${m.name}</span><i>${s.mode === m.id ? '●' : '○'}</i></button>`).join('')}</div><p class="ns-mode-note">${modeNote[s.mode]}</p></fieldset>
      <fieldset><legend><span>02</span> Dificuldade</legend><div class="ns-segments">${DIFFICULTIES.map((d,i) => `<button type="button" data-difficulty="${d.id}" aria-pressed="${s.difficulty === d.id}"><span class="ns-level-bars" aria-hidden="true">${'<i></i>'.repeat(i+1)}</span>${d.name}</button>`).join('')}</div></fieldset>
      <fieldset><legend><span>03</span> Sua arena <small>${p.unlockedMaps.length} / ${MAPS.length}</small></legend><button type="button" class="ns-map-current" data-open="maps"><span class="ns-map-icon" style="--map-color:${map.color}">${icon('grid')}</span><span><strong>${map.name}</strong><small>Explorar arenas</small></span>${icon('arrow')}</button></fieldset>
      <button type="button" class="ns-play" data-start>${icon('play')} Jogar <span>↗</span></button>
      <div class="ns-start-hint">${icon('touch')} Deslize para jogar · Setas ou WASD no computador</div>
      <nav class="ns-menu-nav" aria-label="Progresso e configurações"><button type="button" data-open="achievements">${icon('trophy')}Conquistas</button><button type="button" data-open="stats">${icon('chart')}Estatísticas</button><button type="button" data-open="settings">${icon('sliders')}Ajustes</button></nav>
    </div><div class="ns-home-footer"><span><i></i> SEM PRESSA PARA CARREGAR. SÓ PARA VIRAR.</span><span>FEITO PARA JOGAR OFFLINE</span></div>`;
    home.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { onSetting('mode',b.dataset.mode); renderHome(); }));
    home.querySelectorAll('[data-difficulty]').forEach(b => b.addEventListener('click', () => { onSetting('difficulty',b.dataset.difficulty); renderHome(); }));
    home.querySelector('[data-start]').addEventListener('click', onStart);
    home.querySelector('[data-open="maps"]').addEventListener('click', showMaps);
    home.querySelector('[data-open="achievements"]').addEventListener('click', showAchievements);
    home.querySelector('[data-open="stats"]').addEventListener('click', showStats);
    home.querySelector('[data-open="settings"]').addEventListener('click', showSettings);
  }
  function dialog(title, html) {
    onOpen();
    const node = document.createElement('div'); node.className = 'ns-dialog-content'; node.innerHTML = html;
    hud.setDialogContent(node, title); hud.openDialog();
    return node;
  }
  function showMaps() {
    const p = getProfile();
    const node = dialog('Escolha sua arena', `<p class="ns-dialog-intro">Colete alimentos em qualquer modo para abrir novos caminhos. Obstáculos próprios de cada arena aparecem no modo Desafio.</p><div class="ns-map-grid">${MAPS.map((m,i) => {
      const unlocked = p.unlockedMaps.includes(m.id);
      return `<button type="button" class="ns-map-card" data-map="${m.id}" ${unlocked ? '' : 'disabled'} aria-pressed="${p.settings.map === m.id}" style="--map-color:${m.color}"><div class="ns-map-preview ns-map-${m.id}"><span>0${i+1}</span>${icon(unlocked ? 'grid' : 'lock')}</div><strong>${m.name}</strong><p>${m.description}</p><small>${unlocked ? (p.settings.map === m.id ? '✓ Selecionada' : 'Disponível') : `${number(p.stats.foods)} / ${m.unlock} alimentos`}</small></button>`;
    }).join('')}</div>`);
    node.querySelectorAll('[data-map]').forEach(b => b.addEventListener('click', () => { onSetting('map', b.dataset.map); renderHome(); hud.closeDialog(); }));
  }
  function showAchievements() {
    const p = getProfile();
    dialog('Conquistas', `<p class="ns-dialog-intro">${p.achievements.length} de ${ACHIEVEMENTS.length} conquistas. Cada partida deixa sua marca.</p><div class="ns-achievements">${ACHIEVEMENTS.map(a => `<div class="ns-achievement" data-unlocked="${p.achievements.includes(a.id)}">${icon(p.achievements.includes(a.id) ? 'trophy' : 'lock')}<div><strong>${a.name}</strong><p>${a.description}</p></div>${p.achievements.includes(a.id) ? icon('check') : ''}</div>`).join('')}</div>`);
  }
  function showStats() {
    const p = getProfile(), s = p.stats;
    dialog('Sua trajetória', `<div class="ns-stats-grid">${[['Maior pontuação',number(p.best)],['Partidas',number(s.games)],['Maior tamanho',number(s.maxLength)],['Melhor combo',`×${s.bestCombo}`],['Alimentos',number(s.foods)],['Tempo jogado',time(s.time)]].map(([label,value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('')}</div><h3>Recordes por modo</h3><div class="ns-records">${MODES.map(m => `<div><span>${m.name}</span><b>${number(p.bestByMode[m.id])}</b></div>`).join('')}</div><h3>Recordes por dificuldade</h3><div class="ns-records">${DIFFICULTIES.map(d => `<div><span>${d.name}</span><b>${number(p.bestByDifficulty[d.id])}</b></div>`).join('')}</div><p class="ns-dialog-intro ns-storage-note">Progresso salvo neste navegador, neste aparelho.</p>`);
  }
  function showSettings() {
    const s = getProfile().settings;
    const settings = [['effects','Efeitos sonoros','Coletas, combos e feedback do jogo.'],['music','Música ambiente','Uma trilha eletrônica para entrar no ritmo.'],['haptics','Vibração','Feedback breve em aparelhos compatíveis.'],['dpad','Botões direcionais','Uma alternativa aos gestos.'],['reducedMotion','Reduzir efeitos visuais','Menos partículas e animações.']];
    const node = dialog('Configurações', `<div class="ns-settings-list">${settings.map(([key,label,description]) => `<label class="ns-switch-row"><span><strong>${label}</strong><small>${description}</small></span><input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}><i aria-hidden="true"></i></label>`).join('')}</div><h3>Como jogar</h3><p class="ns-dialog-intro">Deslize em qualquer direção sobre o tabuleiro ou a área abaixo dele. No computador, use as setas ou WASD. Espaço ou P pausa; Esc também pausa. Colete em até 5 segundos para encadear combos. A cobra não pode virar diretamente contra o próprio corpo.</p><h3>Conheça os itens</h3><div class="ns-item-guide">${Object.values(ITEMS).map(item => `<div><span style="color:${item.color}">${item.symbol}</span><div><strong>${item.name}</strong><p>${item.description}</p></div></div>`).join('')}</div><p class="ns-dialog-intro ns-storage-note">Após o primeiro carregamento completo, o jogo fica disponível offline. Adicione a biblioteca à tela inicial pelo menu do navegador.</p>`);
    node.querySelectorAll('[data-setting]').forEach(input => input.addEventListener('change', () => { onSetting(input.dataset.setting,input.checked); controls.querySelector('.ns-dpad').hidden = !getProfile().settings.dpad; }));
  }
  return {
    home: renderHome, showSettings, showMaps, showAchievements, showStats,
    setScreen(screen) { app.dataset.screen = screen; home.hidden = screen !== 'home'; controls.querySelector('.ns-dpad').hidden = !getProfile().settings.dpad; result.hidden = details.hidden = true; },
    update(state) {
      hud.setStat('score',number(state.score)); hud.setStat('best',number(Math.max(state.score,getProfile().best)));
      hud.setStat('combo',`<span class="ns-combo-value">×${state.combo || 1}</span>`); hud.setStat('level',String(state.level).padStart(2,'0'));
      const map = MAPS.find(m => m.id === state.map) || MAPS[0], mode = MODES.find(m => m.id === state.mode) || MODES[0];
      const label = state.mode === 'challenge' && state.objective ? `${state.objective.label} · ${state.objective.current}/${state.objective.target}` : `${map.name} <span>•</span> ${mode.name}`;
      const next = `<span><i></i> ${label}</span><span>${(1/state.stepDuration).toFixed(1)} células/s</span>`;
      if (strip.innerHTML !== next) strip.innerHTML = next;
      const chips = [];
      if (state.effects.shield) chips.push({text:'◇ Escudo',tone:'accent'});
      for (const [key,label] of [['multiplier','×2 pontos'],['slow','Slow motion'],['turbo','Turbo']]) if (state.effects[key] > 0) chips.push({text:`${label} ${Math.ceil(state.effects[key])}s`,tone:key === 'turbo' ? 'warn' : 'accent'});
      if (state.combo > 1) chips.push({text:`Combo ×${state.combo} · ${state.comboRemaining.toFixed(1)}s`,tone:'flow'});
      hud.setChips(chips);
    },
    showResult(state, best, rewards) {
      result.hidden = details.hidden = false;
      result.innerHTML = `<span>${best ? 'NOVO RECORDE' : 'PONTUAÇÃO FINAL'}</span><strong>${number(state.score)}</strong>`;
      details.innerHTML = [['Recorde',number(getProfile().best)],['Tamanho máximo',state.maxLength],['Alimentos',state.foods],['Melhor combo',`×${state.bestCombo}`]].map(([label,value]) => `<div><span>${label}</span><b>${value}</b></div>`).join('');
      if (rewards.length) hud.el.note.textContent = rewards.join(' · ');
    },
    destroy() { home.remove(); strip.remove(); controls.remove(); result.remove(); details.remove(); menuTool.remove(); }
  };
}
