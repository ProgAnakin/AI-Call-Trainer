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
import { createRequire } from 'node:module';
import process from 'node:process';

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

function stopServer() {
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
async function check(name, fn, { seed = true, collectErrors = true } = {}) {
  const context = await browser.newContext();
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
