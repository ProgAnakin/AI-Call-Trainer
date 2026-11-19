/**
 * Servidor estático que imita o Vercel: serve dist/ aplicando EXATAMENTE as
 * regras de vercel.json (headers + rewrite de SPA).
 *
 * Por que existe: `vite preview` não lê o vercel.json. Os headers de segurança
 * (CSP, HSTS, X-Frame-Options...) nunca tinham rodado contra o build real — um
 * CSP escrito à mão pode bloquear o próprio app (fonte, worker, estilo) sem
 * ninguém perceber até produção. Com este servidor o teste vê o que o navegador
 * do usuário vai ver.
 *
 * Uso: import { startProdServer } from './prod-server.mjs'
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function loadHeaders() {
  const cfg = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));
  const rule = (cfg.headers ?? []).find((h) => h.source === '/(.*)');
  return Object.fromEntries((rule?.headers ?? []).map((h) => [h.key, h.value]));
}

/** Devolve { url, port, headers, close }. */
export async function startProdServer(port = 4180) {
  const headers = await loadHeaders();

  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      // Path traversal: o caminho resolvido tem de continuar dentro de dist/.
      let file = normalize(join(DIST, urlPath));
      if (file !== DIST && !file.startsWith(DIST + sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      let info = await stat(file).catch(() => null);
      if (info?.isDirectory()) {
        file = join(file, 'index.html');
        info = await stat(file).catch(() => null);
      }
      // Rewrite do vercel.json: tudo que não é arquivo cai no index.html (SPA).
      if (!info) file = join(DIST, 'index.html');

      const body = await readFile(file);
      res.writeHead(200, {
        ...headers,
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500).end(String(err?.message ?? err));
    }
  });

  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', ok);
  });
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    headers,
    close: () => new Promise((ok) => server.close(ok)),
  };
}
