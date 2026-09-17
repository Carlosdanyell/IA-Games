// Service worker da biblioteca.
//
// Estratégia: network-first com timeout curto em tudo, cache como rede de
// segurança. Assim o build publicado aparece na primeira abertura com internet,
// sem depender de o service worker novo já ter assumido o controle — e sem
// internet o app continua abrindo pelo cache.
//
// O precache usa { cache: 'reload' } para nunca guardar cópia já vencida do
// HTTP cache do navegador.
//
// Ao adicionar um jogo, inclua os arquivos dele em ASSETS e suba VERSION.
const VERSION = 'ia-games-v33';
const DOC_TIMEOUT = 3500;   // HTML: vale esperar um pouco mais
const ASSET_TIMEOUT = 1200; // módulos e CSS: rédea curta, cache logo atrás
const ASSETS = [
  './',
  './index.html',
  './play.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable.png',
  './core/shell.css',
  './core/shell.js',
  './core/hud.js',
  './core/loop.js',
  './core/viewport.js',
  './core/collide.js',
  './core/input.js',
  './core/audio.js',
  './core/haptics.js',
  './core/storage.js',
  './core/theme.js',
  './core/sprites.js',
  './core/debug.js',
  './core/rng.js',
  './core/registry.js',
  './games/neon-snake/index.js',
  './games/neon-snake/ui.js',
  './games/neon-snake/config.js',
  './games/neon-snake/model.js',
  './games/neon-snake/render.js',
  './games/neon-snake/audio.js',
  './games/neon-snake/style.css',
  './games/neon-break/index.js',
  './games/neon-break/config.js',
  './games/neon-break/content.js',
  './games/neon-break/levels.js',
  './games/neon-break/render.js',
  './games/neon-break/ui.js',
  './games/neon-words/index.js',
  './games/neon-words/levels.js',
  './games/neon-words/model.js',
  './games/neon-words/style.css',
  './games/neon-arrow/index.js',
  './games/neon-arrow/config.js',
  './games/neon-arrow/levels.js',
  './games/neon-arrow/world.js',
  './games/neon-arrow/blood.js',
  './games/neon-arrow/render.js',
  './games/neon-arrow/ui.js',
  './games/neon-arrow/style.css',
  './games/eight-ball/index.js',
  './games/eight-ball/config.js',
  './games/eight-ball/table.js',
  './games/eight-ball/physics.js',
  './games/eight-ball/rules.js',
  './games/eight-ball/ai.js',
  './games/eight-ball/render.js',
  './games/eight-ball/ui.js',
  './games/eight-ball/lan-protocol.js',
  './games/eight-ball/lan-transport.js',
  './games/eight-ball/lan-ui.js',
  './games/eight-ball/style.css',
  './games/neon-grid/index.js',
  './games/neon-grid/model.js',
  './games/neon-grid/ai.js',
  './games/neon-grid/style.css',
  './games/neon-drop/index.js',
  './games/neon-drop/config.js',
  './games/neon-drop/stages.js',
  './games/neon-drop/model.js',
  './games/neon-drop/ai.js',
  './games/neon-drop/render.js',
  './games/neon-drop/ui.js',
  './games/neon-drop/style.css',
  './games/neon-shooter/index.js',
  './games/neon-shooter/config.js',
  './games/neon-shooter/progress.js',
  './games/neon-shooter/enemies.js',
  './games/neon-shooter/world.js',
  './games/neon-shooter/render.js',
  './games/neon-shooter/audio.js',
  './games/neon-shooter/ui.js',
  './games/neon-shooter/style.css',
  './games/neon-slither/index.js',
  './games/neon-slither/config.js',
  './games/neon-slither/model.js',
  './games/neon-slither/render.js',
  './games/neon-slither/style.css'
];

self.addEventListener('install', event => {
  // skipWaiting aqui é só a primeira tentativa: enquanto o worker antigo ainda
  // atende requisições da página, o navegador recusa a promoção e a versão nova
  // fica parada em "waiting". Por isso a página também manda SKIP_WAITING assim
  // que o install termina (ver index.html/play.html).
  self.skipWaiting();
  event.waitUntil(
    caches.open(VERSION)
      // cache: 'reload' ignora o HTTP cache: o precache sempre nasce do servidor.
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (data.type === 'VERSION') {
    const reply = { type: 'VERSION', version: VERSION };
    if (event.ports && event.ports[0]) event.ports[0].postMessage(reply);
    else if (event.source) event.source.postMessage(reply);
  }
});

const isDocument = (request, url) =>
  request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');

function withTimeout(promise, ms) {
  let timer;
  const alarm = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); });
  return Promise.race([promise, alarm]).finally(() => clearTimeout(timer));
}

// Guarda a cópia e devolve a resposta original (o corpo só pode ser lido uma vez).
function keep(request, response) {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(VERSION).then(cache => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

function cached(request, url) {
  const doc = isDocument(request, url);
  return caches.match(request, { ignoreSearch: doc })
    .then(hit => hit || (doc ? caches.match('./index.html') : undefined));
}

// fetch() dentro do service worker também passa pelo HTTP cache do navegador,
// e o GitHub Pages manda Cache-Control: max-age=600 — ou seja, "ir à rede"
// devolveria o arquivo de até 10 minutos atrás. cache: 'no-cache' obriga a
// revalidar com o servidor (ETag: responde 304 quando nada mudou, então custa
// quase nada).
function freshRequest(request) {
  // Requisição de navegação não pode ser reconstruída com init; refaz pela URL.
  if (request.mode === 'navigate') {
    return new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' });
  }
  return new Request(request, { cache: 'no-cache' });
}

async function networkFirst(event, request, url, ms) {
  // A rede segue viva mesmo quando o timeout vence: o cache é atualizado do
  // mesmo jeito, então a próxima abertura já sai com o arquivo novo.
  const net = fetch(freshRequest(request)).then(response => keep(request, response));
  try {
    return await withTimeout(net, ms);
  } catch (_) {
    const hit = await cached(request, url);
    if (hit) {
      event.waitUntil(net.catch(() => {}));
      return hit;
    }
    return net;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const doc = isDocument(request, url);
  event.respondWith(networkFirst(event, request, url, doc ? DOC_TIMEOUT : ASSET_TIMEOUT));
});
