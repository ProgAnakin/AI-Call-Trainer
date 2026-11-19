/**
 * Bateria de ataque ao CLIENTE — o que acontece quando o dado que chega ao app
 * é hostil: um backup baixado de algum lugar, um localStorage adulterado, um
 * texto desenhado para travar o analisador.
 *
 * O app é single-player e não tem servidor próprio de dados, então a pergunta
 * certa NÃO é "alguém rouba os dados de outro" (não há outro), e sim:
 *   1. um arquivo malicioso consegue corromper o app de quem o importa?
 *   2. um texto de entrada consegue travar a aba (ReDoS)?
 *   3. um dado malformado deixa o app em crash loop sem saída?
 *
 * Cada teste afirma o comportamento SEGURO. Vermelho antes de uma correção =
 * vulnerabilidade observada; verde depois = regressão permanente.
 *
 * Ids: P=poluição de protótipo · S=schema do backup · R=ReDoS/desempenho ·
 *      F=fuzz · V=injeção em CSV · L=idioma.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEED_PERSONAS } from '@/data/seed/personas';
import { SEED_PRODUCTS } from '@/data/seed/products';
import { SEED_SCENARIOS } from '@/data/seed/scenarios';
import { analyzeEmail } from '@/lib/coldEmail';
import { csvCell, importBackupFile } from '@/lib/exporters';
import { computeMetrics } from '@/lib/metrics';
import {
  getObjectionStats,
  recordObjectionResult,
  scoreObjectionResponse,
} from '@/lib/objections';
import {
  listEvaluations,
  listPersonas,
  listProducts,
  listScenarios,
  listSessions,
  listTurns,
  restoreBackup,
} from '@/lib/storage';
import { resolveUiLang } from '@/i18n';
import { evaluateCall } from '@/lib/api';
import { isEvaluation, isSession } from '@/lib/schema';
import { createSession, readBackup } from '@/lib/storage';
import { getDrillBest, saveDrillBest } from '@/lib/objections';
import { getEmailBest } from '@/lib/coldEmail';
import type { Evaluation, Session, Turn } from '@/types';

// ---------- infra ----------

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

/** Marcadores que um ataque de poluição deixaria em TODO objeto do runtime. */
const POLLUTION_PROBES = ['x', 'y', 'z', 'n', 'sum', 'polluted', 'objection'];
const cleanPrototype = () => {
  for (const k of POLLUTION_PROBES) delete (Object.prototype as Record<string, unknown>)[k];
};
const polluted = () =>
  POLLUTION_PROBES.filter((k) => k in ({} as Record<string, unknown>));

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  cleanPrototype();
});
afterEach(() => {
  cleanPrototype(); // nunca deixa um teste contaminar os seguintes
  vi.unstubAllGlobals();
});

const validSession = (id = 's1'): Session => ({
  id,
  scenario_id: SEED_SCENARIOS[0].id,
  started_at: '2026-01-01T10:00:00.000Z',
  ended_at: '2026-01-01T10:05:00.000Z',
  mode: 'text',
  outcome: 'abandoned',
});
const validTurn = (session_id = 's1', id = 't1'): Turn => ({
  id,
  session_id,
  speaker: 'rep',
  content: 'Hello',
  ts: '2026-01-01T10:00:01.000Z',
});
const validEval = (session_id = 's1', id = 'e1'): Evaluation => ({
  id,
  session_id,
  overall_score: 70,
  scores: { abertura: { score: 7, comment: 'ok' } },
  strengths: [{ point: 'a', quote: 'b' }],
  improvements: [{ point: 'a', instead_try: 'b' }],
  framework: 'basic',
  created_at: '2026-01-01T10:06:00.000Z',
});

// ======================================================================
// P — poluição de protótipo
// ======================================================================
describe('P · poluição de protótipo', () => {
  it.each([
    ['__proto__', 'x'],
    ['constructor', 'y'],
    ['prototype', 'z'],
    ['produto-normal', '__proto__'],
    ['produto-normal', 'constructor'],
  ])('P1 recordObjectionResult(%s, %s) não contamina Object.prototype', (productId, objection) => {
    // `history[productId] ?? (history[productId] = {})` com productId
    // "__proto__" devolve o PRÓPRIO Object.prototype, e a escrita seguinte
    // cria propriedades em todo objeto do app.
    recordObjectionResult(productId, objection, 5);
    expect(polluted()).toEqual([]);
  });

  it('P2 uma objeção chamada "__proto__" não quebra as estatísticas de ninguém', () => {
    recordObjectionResult('p1', '__proto__', 8);
    expect(polluted()).toEqual([]);
    expect(() => getObjectionStats('p1')).not.toThrow();
  });

  it('P3 getObjectionStats com chave perigosa devolve vazio, sem lançar', () => {
    expect(getObjectionStats('__proto__')).toEqual({});
    expect(getObjectionStats('constructor')).toEqual({});
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'P4 backup com id "%s" é descartado em todas as coleções',
    (badId) => {
      const evil = { id: badId };
      restoreBackup({
        sessions: [{ ...validSession(), id: badId }],
        turns: [{ ...validTurn(), id: badId }],
        evaluations: [{ ...validEval(), id: badId }],
        products: [{ ...SEED_PRODUCTS[0], id: badId }],
        personas: [{ ...SEED_PERSONAS[0], id: badId }],
        scenarios: [{ ...SEED_SCENARIOS[0], id: badId }],
      });
      void evil;
      expect(listSessions().some((s) => s.id === badId)).toBe(false);
      expect(listProducts().some((p) => p.id === badId)).toBe(false);
      expect(listPersonas().some((p) => p.id === badId)).toBe(false);
      expect(listScenarios().some((s) => s.id === badId)).toBe(false);
      expect(listEvaluations().some((e) => e.id === badId)).toBe(false);
    },
  );

  it('P5 chaves "__proto__" dentro do JSON do backup não envenenam o runtime', async () => {
    const json = `{"sessions":[],"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}`;
    const file = new File([json], 'backup.json', { type: 'application/json' });
    await importBackupFile(file);
    expect(polluted()).toEqual([]);
  });
});

// ======================================================================
// S — schema do backup (a porta de entrada de dado hostil)
// ======================================================================
describe('S · um backup malformado não pode corromper o app', () => {
  it('S0 [controle] um backup bem formado é importado por inteiro', () => {
    const added = restoreBackup({
      sessions: [validSession('s1'), validSession('s2')],
      turns: [validTurn('s1', 't1'), validTurn('s2', 't2')],
      evaluations: [validEval('s1', 'e1')],
      products: [{ ...SEED_PRODUCTS[0], id: 'custom-p', custom: true }],
      personas: [{ ...SEED_PERSONAS[0], id: 'custom-a', custom: true }],
      scenarios: [{ ...SEED_SCENARIOS[0], id: 'custom-s', custom: true }],
    });
    expect(added).toBe(2);
    expect(listSessions()).toHaveLength(2);
    expect(listTurns('s1')).toHaveLength(1);
    expect(listEvaluations()).toHaveLength(1);
    expect(listProducts().some((p) => p.id === 'custom-p')).toBe(true);
  });

  it('S1 sessão sem started_at é descartada (listSessions ordena com localeCompare)', () => {
    // `b.started_at.localeCompare` lança TypeError em undefined — e o Home, o
    // Progresso e o Scorecard chamam listSessions. Um único item ruim derruba
    // todas as telas, e ao recarregar o dado ruim continua lá: crash loop.
    restoreBackup({
      sessions: [{ id: 'ruim' } as unknown as Session, validSession('boa')],
    });
    expect(() => listSessions()).not.toThrow();
    expect(listSessions().map((s) => s.id)).toEqual(['boa']);
  });

  it('S2 turno sem ts ou com content não-string é descartado', () => {
    restoreBackup({
      sessions: [validSession('s1')],
      turns: [
        { id: 't-a', session_id: 's1', speaker: 'rep', content: { evil: 1 }, ts: 'x' } as unknown as Turn,
        { id: 't-b', session_id: 's1', speaker: 'rep', content: 'ok' } as unknown as Turn,
        { id: 't-c', session_id: 's1', speaker: 'hacker', content: 'ok', ts: 'x' } as unknown as Turn,
        validTurn('s1', 't-ok'),
      ],
    });
    expect(() => listTurns('s1')).not.toThrow();
    expect(listTurns('s1').map((t) => t.id)).toEqual(['t-ok']);
  });

  it('S3 avaliação com formato quebrado é descartada', () => {
    restoreBackup({
      sessions: [validSession('s1')],
      evaluations: [
        { id: 'e-a', session_id: 's1', created_at: 'x' } as unknown as Evaluation,
        { ...validEval('s1', 'e-b'), scores: 'não é objeto' } as unknown as Evaluation,
        { ...validEval('s1', 'e-c'), strengths: 'não é lista' } as unknown as Evaluation,
        { ...validEval('s1', 'e-d'), overall_score: 'alto' } as unknown as Evaluation,
        validEval('s1', 'e-ok'),
      ],
    });
    expect(() => listEvaluations()).not.toThrow();
    expect(listEvaluations().map((e) => e.id)).toEqual(['e-ok']);
  });

  it('S4 produto com listas quebradas é descartado (a Biblioteca faz .map nelas)', () => {
    restoreBackup({
      products: [
        { ...SEED_PRODUCTS[0], id: 'p-a', common_objections: 'não é lista' } as never,
        { ...SEED_PRODUCTS[0], id: 'p-b', key_features: null } as never,
        { ...SEED_PRODUCTS[0], id: 'p-c', competitors: [null] } as never,
        { ...SEED_PRODUCTS[0], id: 'p-ok' },
      ],
    });
    const ids = listProducts().map((p) => p.id);
    expect(ids).toContain('p-ok');
    expect(ids).not.toContain('p-a');
    expect(ids).not.toContain('p-b');
    expect(ids).not.toContain('p-c');
  });

  it('S5 persona e cenário com tipos errados são descartados', () => {
    restoreBackup({
      personas: [
        { ...SEED_PERSONAS[0], id: 'a-bad', personality: null } as never,
        { ...SEED_PERSONAS[0], id: 'a-bad2', pain_points: 'x' } as never,
        { ...SEED_PERSONAS[0], id: 'a-ok' },
      ],
      scenarios: [
        { ...SEED_SCENARIOS[0], id: 's-bad', difficulty: 'alta' } as never,
        { ...SEED_SCENARIOS[0], id: 's-bad2', language: 'klingon' } as never,
        { ...SEED_SCENARIOS[0], id: 's-bad3', call_type: 'x'.repeat(10) } as never,
        { ...SEED_SCENARIOS[0], id: 's-ok' },
      ],
    });
    const pids = listPersonas().map((p) => p.id);
    expect(pids).toContain('a-ok');
    expect(pids).not.toContain('a-bad');
    expect(pids).not.toContain('a-bad2');
    const sids = listScenarios().map((s) => s.id);
    expect(sids).toContain('s-ok');
    expect(sids.filter((i) => i.startsWith('s-bad'))).toEqual([]);
  });

  it('S6 um backup NÃO pode sobrescrever o catálogo embutido (seed)', () => {
    // Mesmo id de um produto do seed: sem proteção, o backup trocaria o produto
    // oficial por uma versão adulterada (ex.: objeções com instruções falsas).
    const seed = SEED_PRODUCTS[0];
    restoreBackup({ products: [{ ...seed, name: 'ADULTERADO', custom: true }] });
    expect(listProducts().filter((p) => p.name === 'ADULTERADO')).toHaveLength(0);
    expect(listProducts().filter((p) => p.id === seed.id)).toHaveLength(1);
  });

  it('S7 teto de itens por coleção (um backup de milhões não enche o storage)', () => {
    const many = Array.from({ length: 20_000 }, (_, i) => validSession(`s${i}`));
    restoreBackup({ sessions: many });
    expect(listSessions().length).toBeLessThanOrEqual(5_000);
  });

  it('S8 strings gigantes dentro de um item válido são recusadas', () => {
    restoreBackup({
      sessions: [validSession('s1')],
      turns: [{ ...validTurn('s1', 'big'), content: 'x'.repeat(2_000_000) }],
    });
    expect(listTurns('s1').some((t) => t.id === 'big')).toBe(false);
  });

  it('S9 coleções que não são arrays são ignoradas sem lançar', () => {
    expect(() =>
      restoreBackup({
        sessions: 'x' as never,
        turns: { length: 5 } as never,
        evaluations: 42 as never,
        products: null as never,
      }),
    ).not.toThrow();
  });

  it('S10 importBackupFile rejeita não-JSON, JSON sem sessions e arquivo enorme', async () => {
    const bad = (body: string) => importBackupFile(new File([body], 'x.json'));
    expect((await bad('isto não é json')).ok).toBe(false);
    expect((await bad('{"foo":1}')).ok).toBe(false);
    expect((await bad('[]')).ok).toBe(false);
    expect((await bad('null')).ok).toBe(false);
    const huge = new File(['{"sessions":[],"pad":"' + 'x'.repeat(30_000_000) + '"}'], 'huge.json');
    expect((await importBackupFile(huge)).ok).toBe(false);
  });
});

// ======================================================================
// R — ReDoS / desempenho com entrada hostil
// ======================================================================
describe('R · entrada hostil não trava a aba', () => {
  const BIG = 1_000_000;
  const adversarial: [string, string][] = [
    ['1 MB de "a"', 'a'.repeat(BIG)],
    ['1 MB de espaços', ' '.repeat(BIG)],
    ['1 MB de pontuação', '!?.,;:'.repeat(BIG / 6)],
    ['1 MB de palavras curtas', 'a '.repeat(BIG / 2)],
    ['1 MB de apóstrofos', "'".repeat(BIG)],
    ['1 MB de quebras de linha', '\n'.repeat(BIG)],
    ['1 MB de emoji', '🎙️'.repeat(BIG / 4)],
    ['1 MB de combinantes', 'a' + '́'.repeat(BIG)],
    ['1 MB de "you " repetido', 'you '.repeat(BIG / 4)],
    ['1 MB de URL', 'http://x.com/'.repeat(BIG / 13)],
    ['1 MB de "?" em sequência', '?'.repeat(BIG)],
  ];

  it.each(adversarial)('R1 analyzeEmail com %s termina em tempo razoável', (_n, text) => {
    const t0 = performance.now();
    const r = analyzeEmail({ subject: text.slice(0, 500), body: text, lang: 'en' });
    const ms = performance.now() - t0;
    expect(Number.isFinite(r.score)).toBe(true);
    expect(ms).toBeLessThan(2_500);
  });

  it.each(adversarial)('R2 scoreObjectionResponse com %s termina em tempo razoável', (_n, text) => {
    const t0 = performance.now();
    const r = scoreObjectionResponse(text, 'en');
    const ms = performance.now() - t0;
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(10);
    expect(ms).toBeLessThan(2_500);
  });

  it('R3 computeMetrics com 5.000 turnos longos termina em tempo razoável', () => {
    const turns = Array.from({ length: 5_000 }, (_, i) => ({
      speaker: (i % 2 === 0 ? 'rep' : 'prospect') as 'rep' | 'prospect',
      content: 'Quanto custa? E como funciona? Tipo, né, então '.repeat(40),
      ts: new Date(Date.UTC(2026, 0, 1, 10, 0, i)).toISOString(),
    }));
    const t0 = performance.now();
    const m = computeMetrics(turns, '2026-01-01T10:00:00Z', '2026-01-01T12:00:00Z', 'pt-BR');
    expect(performance.now() - t0).toBeLessThan(5_000);
    expect(Number.isFinite(m.talkRatioRep)).toBe(true);
  });
});

// ======================================================================
// F — fuzz com invariantes
// ======================================================================
describe('F · fuzz: nunca lança e os números ficam em faixa', () => {
  /** PRNG determinístico — uma falha precisa ser reproduzível. */
  function mulberry32(seed: number) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ALPHABET = [
    'a', 'B', 'z', ' ', ' ', '\n', '\t', '\r', '!', '?', '.', ',', "'", '’', '"', '-', '=', '+', '@', '<', '>',
    '&', '%', '$', '\\', '/', '\0', '​', '‮', '́', 'é', 'ç', 'ñ', 'ß', '你', 'م', '🎙️', '\ud83d',
    '__proto__', 'constructor', 'http://x', 'you', 'we', 'free', '100%', 'quanto custa', 'obrigado', '$(rm -rf)',
  ];
  const randomText = (rnd: () => number, len: number) =>
    Array.from({ length: len }, () => ALPHABET[Math.floor(rnd() * ALPHABET.length)]).join('');

  it('F1 analyzeEmail: 400 entradas aleatórias, score inteiro em 0..100', () => {
    const rnd = mulberry32(1337);
    for (let i = 0; i < 400; i++) {
      const text = randomText(rnd, Math.floor(rnd() * 600));
      for (const lang of ['pt', 'it', 'en'] as const) {
        const r = analyzeEmail({ subject: text.slice(0, 80), body: text, lang });
        expect(Number.isInteger(r.score), `score=${r.score} para ${JSON.stringify(text.slice(0, 60))}`).toBe(true);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('F2 scoreObjectionResponse: 400 entradas aleatórias, nota em 0..10', () => {
    const rnd = mulberry32(2026);
    for (let i = 0; i < 400; i++) {
      const text = randomText(rnd, Math.floor(rnd() * 500));
      for (const lang of ['pt', 'it', 'en', 'pt-BR', 'it-IT', 'en-US', 'pt-PT'] as const) {
        const r = scoreObjectionResponse(text, lang);
        expect(Number.isFinite(r.score)).toBe(true);
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(10);
      }
    }
  });

  it('F3 computeMetrics: transcrições aleatórias nunca produzem NaN/Infinity', () => {
    const rnd = mulberry32(7);
    for (let i = 0; i < 150; i++) {
      const n = Math.floor(rnd() * 12);
      const turns = Array.from({ length: n }, (_, k) => ({
        speaker: (rnd() < 0.5 ? 'rep' : 'prospect') as 'rep' | 'prospect',
        content: randomText(rnd, Math.floor(rnd() * 200)),
        ts: rnd() < 0.2 ? 'data-invalida' : new Date(Date.UTC(2026, 0, 1, 10, 0, k * 5)).toISOString(),
      }));
      const m = computeMetrics(turns, rnd() < 0.2 ? 'lixo' : '2026-01-01T10:00:00Z', '2026-01-01T10:10:00Z', 'en-US');
      for (const [k, v] of Object.entries(m)) {
        if (typeof v === 'number') expect(Number.isFinite(v), `${k}=${v}`).toBe(true);
      }
      expect(m.talkRatioRep).toBeGreaterThanOrEqual(0);
      expect(m.talkRatioRep).toBeLessThanOrEqual(1);
    }
  });
});

// ======================================================================
// V — injeção de fórmula em CSV
// ======================================================================
describe('V · CSV injection', () => {
  it.each([
    ['=cmd|\' /C calc\'!A0', 'DDE clássico'],
    ['=HYPERLINK("http://evil","clique")', 'hyperlink'],
    ['+1+1', 'soma'],
    ['-2+3', 'subtração'],
    ['@SUM(1+1)', 'função com @'],
    ['\t=1+1', 'tab antes do ='],
    ['\r=1+1', 'CR antes do ='],
    ['=1+1\n=2+2', 'fórmula multilinha'],
  ])('V1 %s (%s) sai neutralizado', (payload) => {
    const cell = csvCell(payload);
    // Dentro das aspas, o 1º caractere não pode ser um disparador de fórmula.
    const inner = cell.slice(1, -1);
    expect(inner).not.toMatch(/^[=+\-@\t\r]/);
  });

  it('V2 aspas e quebras de linha não escapam da célula', () => {
    const cell = csvCell('a","b"\n=1+1');
    expect(cell.startsWith('"')).toBe(true);
    expect(cell.endsWith('"')).toBe(true);
    // Toda aspa interna precisa estar dobrada.
    expect(cell.slice(1, -1).replace(/""/g, '')).not.toContain('"');
  });

  it('V3 valores não-string (número, null, objeto) não lançam', () => {
    expect(() => csvCell(null)).not.toThrow();
    expect(() => csvCell(undefined)).not.toThrow();
    expect(() => csvCell({ a: 1 })).not.toThrow();
    expect(() => csvCell(NaN)).not.toThrow();
  });
});

// ======================================================================
// L — idioma salvo adulterado
// ======================================================================
describe('L · idioma salvo no localStorage', () => {
  it.each(['en', 'pt', 'it'])('L1 aceita o idioma válido "%s"', (l) => {
    expect(resolveUiLang(l)).toBe(l);
  });

  it.each([
    'constructor',
    '__proto__',
    'toString',
    'hasOwnProperty',
    'valueOf',
    'xx',
    '',
    'EN',
    '<script>',
    null,
  ])('L2 valor inválido %j cai em "en"', (v) => {
    // `saved in DICTS` considera chaves herdadas de Object.prototype — "constructor"
    // passava e virava o idioma ativo.
    expect(resolveUiLang(v as string | null)).toBe('en');
  });
});

// ======================================================================
// T — adulteração DIRETA do storage (sem passar pelo import)
// ======================================================================
describe('T · localStorage adulterado diretamente não derruba nenhuma leitura', () => {
  const TAMPERED: [string, string, string][] = [
    ['act.sessions', '[{"id":"x"}]', 'sessão sem campos'],
    ['act.sessions', '[null]', 'sessão null'],
    ['act.sessions', '"texto"', 'sessões como string'],
    ['act.sessions', '{"length":3}', 'sessões como objeto'],
    ['act.turns', '[{"id":"t","session_id":"x","speaker":"rep","content":{"a":1},"ts":"x"}]', 'turno com content objeto'],
    ['act.turns', '[null,1,"x"]', 'turnos de tipos soltos'],
    ['act.evaluations', '[{"id":"e","session_id":"s"}]', 'avaliação sem campos'],
    ['act.evaluations', '[{"id":"e","session_id":"s","overall_score":1,"created_at":"2026-01-01T00:00:00Z","scores":null,"strengths":null,"improvements":null}]', 'avaliação com nulls'],
    ['act.custom_products', '[{"id":"p"}]', 'produto sem listas'],
    ['act.custom_products', '[{"id":"p","name":"n","key_features":null}]', 'produto com lista nula'],
    ['act.custom_personas', '[{"id":"a"}]', 'persona sem campos'],
    ['act.custom_scenarios', '[{"id":"s"}]', 'cenário sem campos'],
    ['act.drill.history', '"x"', 'histórico do drill como string'],
    ['act.drill.history', '{"p":"x","q":null,"r":[1]}', 'histórico com entradas quebradas'],
    ['act.drill.history', '[]', 'histórico como array'],
    ['act.drill.best', '"x"', 'recorde como string'],
    ['act.drill.best', 'null', 'recorde null'],
    ['act.email.best', 'abc', 'recorde de e-mail não numérico'],
    ['act.ui_lang', 'constructor', 'idioma = constructor'],
  ];

  it.each(TAMPERED)('T1 %s = %s (%s): leituras não lançam', (key, value) => {
    localStorage.setItem(key, value);
    expect(() => {
      listSessions();
      listTurns('s');
      listEvaluations();
      listProducts();
      listPersonas();
      listScenarios();
      readBackup();
      getObjectionStats('p');
      getDrillBest('p');
      getEmailBest();
    }).not.toThrow();
  });

  it('T2 terminar um drill com "act.drill.best" adulterado não lança (strict mode)', () => {
    localStorage.setItem('act.drill.best', '"x"');
    expect(() => saveDrillBest('p1', 7)).not.toThrow();
    expect(getDrillBest('p1')).toBe(7);
  });

  it('T3 [controle] avaliação com a forma que um LLM de verdade devolve NÃO é descartada', () => {
    // O servidor repassa strengths/improvements como vieram do modelo. Variantes
    // reais: strings no lugar de objetos, `quote` ausente, chaves extras. Nada
    // disso derruba a UI — e descartar faria o scorecard de uma call REAL sumir.
    const llmShaped = [
      { ...validEval(), strengths: ['boa abertura', 'bom tom'], improvements: ['explorar mais'] },
      { ...validEval(), strengths: [{ point: 'só o ponto' }], improvements: [{ point: 'x' }] },
      { ...validEval(), scores: { abertura: { score: 7 } } },
      { ...validEval(), extra_chave_futura: { a: 1 }, framework: undefined },
      { ...validEval(), objection_handling: [{ objection: 'x', quality: 'handled' }], missed_signals: [{ quote: 'q' }] },
      { ...validEval(), focus_next: undefined, opener_rewrite: 'x', best_line: 'y', worst_line: 'z' },
    ];
    for (const ev of llmShaped) expect(isEvaluation(ev), JSON.stringify(ev).slice(0, 80)).toBe(true);
  });

  it('T4 [controle] dados legados (sem mode/outcome/framework) continuam válidos', () => {
    const { mode: _m, outcome: _o, ...legacySession } = validSession();
    expect(isSession(legacySession)).toBe(true);
    const { framework: _f, ...legacyEval } = validEval();
    expect(isEvaluation(legacyEval)).toBe(true);
  });

  it('T5 [controle] a saída REAL do avaliador do modo demo passa na guarda', async () => {
    // Se isto falhar, toda call terminada no modo demo "perderia" o scorecard.
    for (const framework of ['basic', 'SPICED', 'MEDDIC'] as const) {
      for (const ui_language of ['en', 'pt', 'it'] as const) {
        const draft = await evaluateCall({
          transcript: [
            { speaker: 'rep', content: 'Hi, quick question: how do you track follow-ups today?' },
            { speaker: 'prospect', content: 'We use spreadsheets, honestly.' },
            { speaker: 'rep', content: 'Could we book 15 minutes on Thursday at 10?' },
          ],
          call_type: 'cold_call',
          framework,
          language: 'en-US',
          ui_language,
          success_criteria: 'Book a meeting.',
        });
        const ev = { ...draft, id: 'e-demo', session_id: 's1', created_at: new Date().toISOString() };
        expect(isEvaluation(ev), `${framework}/${ui_language}`).toBe(true);
      }
    }
    // O avaliador demo simula ~1 s de latência por chamada: 9 combinações.
  }, 40_000);

  it('T6 item com id do catálogo embutido, gravado direto no storage, não duplica nem substitui o seed', () => {
    const seed = SEED_PRODUCTS[0];
    localStorage.setItem('act.custom_products', JSON.stringify([{ ...seed, name: 'ADULTERADO' }]));
    const same = listProducts().filter((p) => p.id === seed.id);
    expect(same).toHaveLength(1);
    expect(same[0].name).toBe(seed.name);
  });

  it('T7 autocura: gravar depois de dado ruim descarta o ruim e mantém o novo', async () => {
    localStorage.setItem('act.sessions', JSON.stringify([{ id: 'ruim' }, validSession('velha')]));
    await createSession(validSession('nova'));
    expect(listSessions().map((s) => s.id).sort()).toEqual(['nova', 'velha']);
    expect(JSON.parse(localStorage.getItem('act.sessions') ?? '[]')).toHaveLength(2);
  });
});
