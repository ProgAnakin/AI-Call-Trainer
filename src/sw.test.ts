/**
 * O service worker é código de segurança sem teste nenhum: decide o que o app
 * mostra OFFLINE. Executa public/sw.js de verdade num ambiente simulado.
 *
 * Falhas que isto trava:
 *  - gravar qualquer navegação — inclusive um 502/404 transitório — por cima do
 *    index.html offline (a "versão offline" do app virava uma página de erro);
 *  - cache de assets que só crescia, deploy após deploy;
 *  - guardar resposta opaca ou de outra origem.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// SW_PATH permite apontar o mesmo teste para outra versão do arquivo.
const SRC = readFileSync(process.env.SW_PATH ?? join(__dirname, '..', 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://app.test';

type Handler = (event: unknown) => void;

/**
 * Resposta com o `type` que um fetch real de mesma origem teria ('basic').
 * O clone também precisa ter o mesmo type: num navegador `clone()` de uma
 * resposta basic continua basic (o service worker clona antes de guardar).
 */
function res(body: string, status: number, type: ResponseType = 'basic'): Response {
  const make = (): Response => {
    const r = new Response(body, { status });
    Object.defineProperty(r, 'type', { value: type });
    Object.defineProperty(r, 'clone', { value: make });
    return r;
  };
  return make();
}

function boot(fetchImpl: (req: unknown) => Promise<Response>) {
  const listeners: Record<string, Handler> = {};
  const store = new Map<string, Response>();
  const cachesDeleted: string[] = [];
  let existingCaches = ['act-cache-v1', 'act-cache-v2', 'outro-app'];

  const cache = {
    addAll: async () => {},
    put: async (req: { url: string } | string, r: Response) => {
      store.set(typeof req === 'string' ? new URL(req, ORIGIN).href : req.url, r);
    },
    keys: async () => [...store.keys()].map((url) => ({ url })),
    delete: async (k: { url: string }) => store.delete(k.url),
    match: async (req: { url: string } | string) =>
      store.get(typeof req === 'string' ? new URL(req, ORIGIN).href : req.url),
  };
  const caches = {
    open: async () => cache,
    keys: async () => existingCaches,
    delete: async (name: string) => {
      cachesDeleted.push(name);
      existingCaches = existingCaches.filter((n) => n !== name);
      return true;
    },
    match: cache.match,
  };
  const self = {
    addEventListener: (type: string, fn: Handler) => {
      listeners[type] = fn;
    },
    location: { origin: ORIGIN },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  new Function('self', 'caches', 'fetch', 'URL', 'Request', SRC)(
    self,
    caches,
    fetchImpl,
    URL,
    Request,
  );

  /** Dispara um `fetch` do navegador e espera o service worker terminar tudo. */
  async function dispatch(url: string, mode: RequestMode = 'no-cors', method = 'GET') {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    // `mode` é só-leitura num Request real; um Request de verdade com mode
    // 'navigate' não pode ser construído à mão, então sobrescrevemos o getter.
    const request = new Request(url, { method });
    Object.defineProperty(request, 'mode', { value: mode });
    listeners.fetch({
      request,
      respondWith: (p: Promise<Response>) => (responded = p),
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    const out = responded ? await responded : undefined;
    await Promise.all(waits);
    return out;
  }

  return { dispatch, store, cachesDeleted, listeners, caches };
}

describe('service worker — o que vira a versão offline', () => {
  it('SW1 uma navegação 200 vira o index.html offline', async () => {
    const sw = boot(async () => res('<html>ok</html>', 200));
    await sw.dispatch(`${ORIGIN}/progress`, 'navigate');
    expect(sw.store.has(`${ORIGIN}/index.html`)).toBe(true);
  });

  it.each([502, 503, 404, 500])(
    'SW2 uma navegação %i NÃO sobrescreve o index.html offline',
    async (status) => {
      // Um 502 transitório do host virava a "versão offline" do app, e o usuário
      // sem rede via uma página de erro em vez do app.
      const sw = boot(async () => res('Bad Gateway', status));
      await sw.dispatch(`${ORIGIN}/`, 'navigate');
      expect(sw.store.has(`${ORIGIN}/index.html`)).toBe(false);
    },
  );

  it('SW3 resposta opaca não é guardada', async () => {
    const sw = boot(async () => res('', 0, 'opaque'));
    await sw.dispatch(`${ORIGIN}/assets/x.js`);
    expect(sw.store.size).toBe(0);
  });

  it('SW4 asset 200 de mesma origem é guardado; 404 não', async () => {
    const ok = boot(async () => res('js', 200));
    await ok.dispatch(`${ORIGIN}/assets/a.js`);
    expect(ok.store.has(`${ORIGIN}/assets/a.js`)).toBe(true);
    const bad = boot(async () => res('nope', 404));
    await bad.dispatch(`${ORIGIN}/assets/b.js`);
    expect(bad.store.has(`${ORIGIN}/assets/b.js`)).toBe(false);
  });

  it('SW5 o cache não cresce sem limite (deploys acumulavam assets para sempre)', async () => {
    const sw = boot(async () => res('js', 200));
    for (let i = 0; i < 200; i++) await sw.dispatch(`${ORIGIN}/assets/chunk-${i}.js`);
    expect(sw.store.size).toBeLessThanOrEqual(80);
    // Os mais NOVOS ficam; os mais antigos saem.
    expect(sw.store.has(`${ORIGIN}/assets/chunk-199.js`)).toBe(true);
    expect(sw.store.has(`${ORIGIN}/assets/chunk-0.js`)).toBe(false);
  });

  it('SW6 o shell nunca é expulso pela poda', async () => {
    const sw = boot(async () => res('x', 200));
    await sw.dispatch(`${ORIGIN}/icon.svg`);
    for (let i = 0; i < 200; i++) await sw.dispatch(`${ORIGIN}/assets/c-${i}.js`);
    expect(sw.store.has(`${ORIGIN}/icon.svg`)).toBe(true);
  });

  it('SW7 outras origens e métodos não-GET passam direto, sem cache', async () => {
    const sw = boot(async () => res('x', 200));
    expect(await sw.dispatch('https://abc.supabase.co/functions/v1/roleplay')).toBeUndefined();
    expect(await sw.dispatch(`${ORIGIN}/x`, 'no-cors', 'POST')).toBeUndefined();
    expect(sw.store.size).toBe(0);
  });

  it('SW8 ao ativar, apaga o cache antigo (v1) e mantém só o atual', async () => {
    const sw = boot(async () => res('x', 200));
    const waits: Promise<unknown>[] = [];
    sw.listeners.activate({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(sw.cachesDeleted).toContain('act-cache-v1');
    expect(sw.cachesDeleted).not.toContain('act-cache-v2');
  });
});
