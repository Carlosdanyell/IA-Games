// Abra chess-ui-browser.html pelo servidor local. Sem dependências de teste.
const output = document.querySelector('#results'), fixture = document.querySelector('#fixture');
const sessionKey = 'ia-games:neon-chess:session-v1';
const keys = [sessionKey, 'ia-games:app:palette', 'ia-games:app:theme'];
const backup = keys.map(key => [key, localStorage.getItem(key)]);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, message) => { if (!value) throw new Error(message); };
let frame, win, doc, passed = 0, failed = 0;
output.textContent = '';

async function check(name, fn) {
  try { await fn(); passed++; output.textContent += `✓ ${name}\n`; }
  catch (error) { failed++; output.textContent += `✗ ${name}: ${error.message}\n`; }
}
async function load(width, height) {
  frame?.remove();
  localStorage.setItem(sessionKey, JSON.stringify({ mode: 'local', moves: [] }));
  frame = document.createElement('iframe');
  frame.width = width; frame.height = height;
  frame.src = '../play.html?game=neon-chess';
  const ready = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
  fixture.append(frame); await ready;
  win = frame.contentWindow; doc = frame.contentDocument;
  for (let i = 0; i < 100 && !win.__iaGame; i++) await wait(25);
  assert(win.__iaGame, 'o jogo não iniciou');
  win.__iaGame.loop.stop();
  await Promise.all([...doc.images].map(image => image.decode()));
  await wait(100);
}
const cell = coordinate => doc.querySelector(`[data-coordinate="${coordinate}"]`);
async function move(from, to) {
  cell(from).click(); cell(to).click(); await wait(180);
}
function geometry() {
  const board = doc.querySelector('.nx-board').getBoundingClientRect();
  const zone = doc.querySelector('.nx-board-zone').getBoundingClientRect();
  const outer = doc.querySelector('.nx-board-frame').getBoundingClientRect();
  const squares = [...doc.querySelectorAll('.nx-square')];
  assert(squares.length === 64, '64 casas');
  assert(Math.abs(board.width - board.height) < .1, 'tabuleiro 1:1');
  for (const [index, square] of squares.entries()) {
    const rect = square.getBoundingClientRect(), size = board.width / 8;
    assert(Math.abs(rect.width - size) < .1 && Math.abs(rect.height - size) < .1, `casa ${index} deformada`);
    assert(Math.abs(rect.left - board.left - (index % 8) * size) < .1, `coluna ${index}`);
    assert(Math.abs(rect.top - board.top - Math.floor(index / 8) * size) < .1, `linha ${index}`);
  }
  assert(outer.left >= zone.left - .1 && outer.right <= zone.right + .1 && outer.top >= zone.top - .1 && outer.bottom <= zone.bottom + .1,
    `moldura deve caber na zona (moldura ${outer.width} × ${outer.height}; zona ${zone.width} × ${zone.height})`);
  const surface = doc.querySelector('.nx-surface');
  assert(surface.scrollWidth <= surface.clientWidth + 1, 'sem corte horizontal na superfície');
  assert(doc.documentElement.scrollWidth <= win.innerWidth, 'sem rolagem horizontal na página');
}

try {
  for (const [width, height] of [[320,568],[360,800],[390,844],[768,1024],[844,390],[1440,1000]]) {
    await check(`grade em ${width} × ${height}, antes e depois de lances`, async () => {
      await load(width, height); geometry();
      assert(cell('a8').dataset.shade === 'light' && cell('a1').dataset.shade === 'dark', 'cores de A8/A1');
      assert(doc.querySelectorAll('.nx-square .nx-piece').length === 32, '32 peças no início');
      await move('e2','e4'); await move('d7','d5'); await move('e4','d5'); geometry();
      assert(doc.querySelectorAll('.nx-square .nx-piece').length === 31, 'captura remove a peça');
    });
  }
  await load(390,844);
  await check('pausa cobre peças, bloqueia lances e protege o atalho Z', async () => {
    await move('e2','e4');
    const api = win.__iaGame.game, before = api.getState().fen;
    api.pause();
    const rect = cell('e1').getBoundingClientRect();
    assert(doc.elementFromPoint(rect.x + rect.width/2, rect.y + rect.height/2).closest('#hudOverlay'), 'overlay acima das peças');
    assert(doc.querySelector('.nx-surface').inert, 'partida deve ficar inerte');
    win.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    cell('d7').click(); cell('d5').click();
    assert(api.getState().fen === before && api.getState().state === 'paused', 'pausa preserva a posição');
    api.resume(); assert(!doc.querySelector('.nx-surface').inert, 'retomar libera a partida');
  });
  await check('giro mantém coordenadas alinhadas às casas', async () => {
    doc.querySelector('.nx-flip').click();
    assert(doc.querySelector('.nx-square').dataset.coordinate === 'h1', 'H1 no canto superior esquerdo');
    assert(doc.querySelector('.nx-files').textContent === 'HGFEDCBA', 'letras invertidas');
    assert(doc.querySelector('.nx-ranks').textContent === '12345678', 'números invertidos'); geometry();
  });
  await load(390,844);
  await check('promoção oferece quatro peças e devolve o foco', async () => {
    for (const [from,to] of [['a2','a4'],['h7','h5'],['a4','a5'],['h5','h4'],['a5','a6'],['h4','h3'],['a6','b7'],['h3','g2']]) await move(from,to);
    cell('b7').click(); cell('a8').click();
    assert(!doc.querySelector('.nx-promotion').hidden && doc.querySelector('.nx-board').inert, 'promoção bloqueia tabuleiro');
    assert(doc.querySelectorAll('.nx-promotion-option').length === 4, 'quatro escolhas');
    doc.querySelector('.nx-promotion-option').click(); await wait(180);
    assert(cell('a8').querySelector('img').src.endsWith('white_queen.svg'), 'dama promovida');
    assert(doc.activeElement === cell('a8'), 'foco retorna ao destino');
  });
  await check('acabamento neon e as oito paletas nos temas claro e escuro', async () => {
    win.__iaGame.game.openSettings();
    doc.querySelector('[name="nx-board-style"][value="neon"]').click();
    await wait(100);
    const boards = new Set();
    for (const theme of ['dark','light']) {
      doc.querySelector(`[name="nx-theme"][value="${theme}"]`).click();
      for (const radio of doc.querySelectorAll('[name="nx-palette"]')) {
        radio.click();
        boards.add(win.getComputedStyle(cell('a8')).backgroundColor);
        geometry();
      }
    }
    assert(boards.size === 16, 'todas as paletas afetam o tabuleiro');
    win.__iaGame.hud.closeDialog(); win.__iaGame.game.resume();
  });
} catch (error) {
  failed++; output.textContent += `✗ Inicialização: ${error.message}\n`;
} finally {
  frame?.remove();
  for (const [key,value] of backup) value === null ? localStorage.removeItem(key) : localStorage.setItem(key,value);
  output.textContent += `\n${passed} passaram; ${failed} falharam.`;
  document.body.dataset.status = failed ? 'failed' : 'passed';
}
