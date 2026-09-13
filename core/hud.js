// Chrome compartilhado da biblioteca: topbar, placar, barra de efeitos, arena,
// overlay, toast, rodapé e diálogo. Um jogo só descreve seus campos e reage
// aos eventos — não toca no DOM.
//
// Todas as escritas passam por um buffer e são aplicadas uma vez por frame
// (`flush`). Escrever no DOM dentro do laço de física, como fazia a versão
// anterior, provoca leitura/recálculo de layout a cada colisão.

const ICONS = {
  soundOn: '<path d="M11 5 6 9H3v6h3l5 4zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14"/>',
  soundOff: '<path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 15a9 9 0 0 1-11-11 9 9 0 1 0 11 11z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 5 10 7-10 7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  back: '<path d="M15 19l-7-7 7-7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};

export function createHud(root, config) {
  root.innerHTML = `
  <main class="app">
    <header class="topbar">
      <div class="brand">
        <a class="mark" id="hudBack" href="${config.backHref || '../../index.html'}" aria-label="Voltar para a biblioteca" title="Voltar">
          <svg viewBox="0 0 24 24">${ICONS.back}</svg>
        </a>
        <div>
          <h1>${config.title}</h1>
          <div class="edition" id="hudSubtitle">${config.subtitle || ''}</div>
        </div>
      </div>
      <div class="tools">
        <button class="icon-button" id="hudSound" aria-label="Ativar som" aria-pressed="false" title="Ativar som"><svg viewBox="0 0 24 24" id="hudSoundIcon">${ICONS.soundOff}</svg></button>
        <button class="icon-button" id="hudTheme" aria-label="Alternar tema" title="Alternar tema"><svg viewBox="0 0 24 24" id="hudThemeIcon">${ICONS.sun}</svg></button>
        <button class="icon-button" id="hudPause" aria-label="Pausar" title="Pausar" disabled><svg viewBox="0 0 24 24" id="hudPauseIcon">${ICONS.pause}</svg></button>
      </div>
    </header>
    <section class="scorebar" id="hudStats" aria-label="Placar"></section>
    <div class="chipbar" id="hudChips" aria-label="Efeitos ativos"></div>
    <section class="arena" id="hudArena" aria-label="${config.arenaLabel || 'Área de jogo'}">
      <canvas id="hudCanvas">${config.canvasFallback || 'Ative JavaScript e Canvas para jogar.'}</canvas>
      <div id="toast" aria-hidden="true"></div>
      <div class="overlay" id="hudOverlay">
        <div class="panel">
          <div class="eyebrow" id="hudTag"></div>
          <h2 id="hudTitle"></h2>
          <p id="hudText"></p>
          <button class="primary" id="hudAction"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 12 8-12 8z"/></svg><span id="hudActionText">Jogar</span></button>
          <button class="secondary" id="hudSecondary" hidden></button>
          <div class="panel-note" id="hudNote"></div>
        </div>
      </div>
    </section>
    <footer class="footer">
      <span id="hudHint"></span>
      <button class="link-button" id="hudSettings">Ajustes &amp; bônus <span aria-hidden="true">↗</span></button>
    </footer>
  </main>
  <dialog id="hudDialog" aria-labelledby="hudDialogTitle">
    <div class="dialog-head"><h2 id="hudDialogTitle">Ajustes</h2>
      <button class="icon-button" id="hudDialogClose" aria-label="Fechar"><svg viewBox="0 0 24 24">${ICONS.close}</svg></button></div>
    <div class="dialog-body" id="hudDialogBody"></div>
  </dialog>
  <div id="hudAnnounce" role="status" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)"></div>`;

  const $ = id => root.querySelector('#' + id);
  const el = {
    canvas: $('hudCanvas'), arena: $('hudArena'), stats: $('hudStats'), chips: $('hudChips'),
    overlay: $('hudOverlay'), tag: $('hudTag'), title: $('hudTitle'), text: $('hudText'),
    action: $('hudAction'), actionText: $('hudActionText'), secondary: $('hudSecondary'),
    note: $('hudNote'), toast: $('toast'), pause: $('hudPause'), pauseIcon: $('hudPauseIcon'),
    sound: $('hudSound'), soundIcon: $('hudSoundIcon'), theme: $('hudTheme'), themeIcon: $('hudThemeIcon'),
    settings: $('hudSettings'), dialog: $('hudDialog'), dialogBody: $('hudDialogBody'),
    hint: $('hudHint'), announce: $('hudAnnounce'), subtitle: $('hudSubtitle')
  };

  // Placar declarativo.
  const statNodes = new Map();
  el.stats.style.gridTemplateColumns = config.stats.map(s => s.flex || '1fr').join(' ');
  for (const def of config.stats) {
    const box = document.createElement('div');
    box.className = 'stat';
    if (def.accent) box.dataset.accent = '1';
    box.innerHTML = `<div class="label">${def.label}</div>` +
      (def.type === 'hearts'
        ? `<div class="hearts" data-role="value"></div>`
        : `<div class="value" data-role="value"></div>`);
    el.stats.appendChild(box);
    statNodes.set(def.id, { box, value: box.querySelector('[data-role="value"]'), def });
  }

  const pending = new Map();
  const applied = new Map();
  let chipsKey = '';
  let toastTime = 0, toastPriority = 0;

  function queue(key, fn, token) {
    if (applied.get(key) === token) return;
    pending.set(key, () => { fn(); applied.set(key, token); });
  }

  const api = {
    el,
    canvas: el.canvas,
    arena: el.arena,

    setStat(id, text, ariaLabel) {
      const node = statNodes.get(id);
      if (!node) return;
      queue('stat:' + id, () => {
        node.value.innerHTML = text;
        if (ariaLabel) node.box.setAttribute('aria-label', ariaLabel);
      }, text + '|' + (ariaLabel || ''));
    },

    setHearts(id, total, left) {
      const node = statNodes.get(id);
      if (!node) return;
      queue('stat:' + id, () => {
        let html = '';
        for (let i = 0; i < total; i++) html += `<span class="heart${i < left ? '' : ' lost'}" aria-hidden="true">♥</span>`;
        node.value.innerHTML = html;
        node.box.setAttribute('aria-label', `${left} de ${total} vidas`);
      }, total + ':' + left);
    },

    setChips(list, ariaLabel) {
      const key = JSON.stringify(list);
      if (key === chipsKey) return;
      chipsKey = key;
      pending.set('chips', () => {
        el.chips.innerHTML = list.map(c =>
          `<span class="chip"${c.tone ? ` data-tone="${c.tone}"` : ''}>${c.text}</span>`).join('');
        if (ariaLabel) el.chips.setAttribute('aria-label', ariaLabel);
      });
    },

    setHint(html) { queue('hint', () => { el.hint.innerHTML = html; }, html); },
    setSubtitle(text) { queue('subtitle', () => { el.subtitle.textContent = text; }, text); },

    flush() {
      if (!pending.size) return;
      for (const fn of pending.values()) fn();
      pending.clear();
    },

    announce(text) { el.announce.textContent = text; },

    showOverlay({ tag = '', title = '', text = '', action = 'Jogar', note = '', secondary = null }) {
      el.overlay.hidden = false;
      el.tag.textContent = tag;
      el.title.innerHTML = title;
      el.text.textContent = text;
      el.actionText.textContent = action;
      el.note.textContent = note;
      el.secondary.hidden = !secondary;
      if (secondary) el.secondary.textContent = secondary;
      toastTime = 0;
      el.toast.classList.remove('show');
      api.announce(`${title}. ${text}`);
    },
    hideOverlay() { el.overlay.hidden = true; },
    get overlayVisible() { return !el.overlay.hidden; },

    toast(text, { tone = '', priority = 1, duration = null } = {}) {
      if (toastTime > 0 && priority < toastPriority) return;
      el.toast.textContent = text;
      el.toast.dataset.tone = tone;
      el.toast.classList.add('show');
      toastTime = duration != null ? duration : (priority > 1 ? 2 : 1.1);
      toastPriority = priority;
      if (priority > 1) api.announce(text);
    },
    tickToast(dt) {
      if (toastTime <= 0) return;
      toastTime -= dt;
      if (toastTime <= 0) el.toast.classList.remove('show');
    },
    clearToast() { toastTime = 0; el.toast.classList.remove('show'); },

    setPause(paused, enabled) {
      queue('pause', () => {
        el.pause.disabled = !enabled;
        el.pauseIcon.innerHTML = paused ? ICONS.play : ICONS.pause;
        const label = paused ? 'Continuar' : 'Pausar';
        el.pause.setAttribute('aria-label', label);
        el.pause.title = label;
      }, `${paused}|${enabled}`);
    },
    setSound(on) {
      queue('sound', () => {
        el.sound.setAttribute('aria-pressed', String(on));
        el.soundIcon.innerHTML = on ? ICONS.soundOn : ICONS.soundOff;
        const label = on ? 'Desativar som' : 'Ativar som';
        el.sound.setAttribute('aria-label', label);
        el.sound.title = label;
      }, String(on));
    },
    setThemeIcon(dark) {
      queue('themeIcon', () => { el.themeIcon.innerHTML = dark ? ICONS.sun : ICONS.moon; }, String(dark));
    },

    setDialogContent(node, title) {
      el.dialogBody.innerHTML = '';
      el.dialogBody.appendChild(node);
      if (title) root.querySelector('#hudDialogTitle').textContent = title;
    },
    openDialog() { if (!el.dialog.open) el.dialog.showModal(); },
    closeDialog() { if (el.dialog.open) el.dialog.close(); },
    get dialogOpen() { return el.dialog.open; }
  };

  el.action.addEventListener('click', () => config.onAction?.());
  el.secondary.addEventListener('click', () => config.onSecondary?.());
  el.pause.addEventListener('click', () => config.onPauseToggle?.());
  el.sound.addEventListener('click', () => config.onSound?.());
  el.theme.addEventListener('click', () => config.onTheme?.());
  el.settings.addEventListener('click', () => config.onSettings?.());
  root.querySelector('#hudDialogClose').addEventListener('click', () => {
    api.closeDialog();
    el.settings.focus();
  });

  return api;
}
