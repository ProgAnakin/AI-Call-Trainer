/* Service worker do AI Call Trainer — offline shell leve, sem dependências.
   Estratégia: network-first para navegação (SPA), stale-while-revalidate para
   assets same-origin. Nunca intercepta origens externas (Supabase, Anthropic,
   serviço de voz do Google) para não quebrar chamadas de rede. */
// v2: a troca de nome faz o `activate` apagar o v1, que podia guardar páginas de
// erro por cima do index.html e acumulava assets de todos os deploys antigos.
const CACHE = 'act-cache-v2';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];
// Teto de entradas fora do shell. Cada deploy gera arquivos com hash novo e os
// antigos nunca saíam do cache: ele só crescia.
const MAX_ENTRIES = 80;

/** Guarda só resposta boa e mantém o cache dentro do teto (descarta as mais antigas). */
async function remember(req, res) {
  // `ok` (2xx) e `basic` (mesma origem): um 502/404 transitório ou uma resposta
  // opaca não podem virar a "versão offline" do app.
  if (!res || !res.ok || res.type !== 'basic') return;
  const cache = await caches.open(CACHE);
  await cache.put(req, res);
  const pinned = new Set(SHELL.map((p) => new URL(p, self.location.origin).href));
  const keys = (await cache.keys()).filter((k) => !pinned.has(k.url));
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) await cache.delete(k);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // deixa passar Supabase/Anthropic/Google

  // Navegação (SPA): rede primeiro; offline cai para o index em cache.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Só a casca boa vira o fallback offline (ver remember()).
          event.waitUntil(remember('/index.html', res.clone()));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Assets same-origin: entrega do cache e revalida em segundo plano.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          event.waitUntil(remember(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
