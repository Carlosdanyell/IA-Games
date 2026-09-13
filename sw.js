// Service worker da biblioteca: cache-first, para que os jogos abram sem rede.
// Ao adicionar um jogo, inclua os arquivos dele em ASSETS e suba VERSION.
const VERSION = 'ia-games-v6';
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
  './games/neon-break/index.js',
  './games/neon-break/config.js',
  './games/neon-break/content.js',
  './games/neon-break/levels.js',
  './games/neon-break/render.js',
  './games/neon-break/ui.js',
  './games/neon-words/index.js',
  './games/neon-words/levels.js',
  './games/neon-words/model.js',
  './games/neon-words/style.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(ASSETS))
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

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: url.pathname.endsWith('.html') }).then(hit => {
      if (hit) return hit;
      return fetch(request).then(response => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
