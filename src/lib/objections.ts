import type { Language, ModelObjection, Product, UiLanguage } from '@/types';
import { langFamilyOf, wordCount } from './metrics';
import { DRILL_LENGTH, DRILL_SUBSTANCE_WORDS } from './thresholds';
import * as safeStorage from './safeStorage';

/**
 * Pontuação de resposta a objeção — 100% client-side (custo zero, feedback
 * instantâneo), ideal para o modo rajada. Mede a técnica clássica
 * Acknowledge → Explore → Respond: reconhecer, explorar com uma pergunta
 * antes de responder, e dar substância — em vez de rebater na hora.
 */

const ACK_PHRASES: Record<'pt' | 'it' | 'en', string[]> = {
  pt: [
    'entendo', 'entendi', 'faz sentido', 'boa pergunta', 'compreendo', 'saquei',
    'justo', 'imagino', 'concordo', 'entendo sua', 'entendo a sua', 'ótimo ponto',
    'otimo ponto', 'boa observação', 'boa observacao',
  ],
  it: [
    'capisco', 'ho capito', 'ha senso', 'buona domanda', 'giusto', 'immagino',
    'comprendo', 'concordo', 'ottima osservazione', 'capisco la sua',
  ],
  en: [
    'i understand', 'i get it', 'makes sense', 'good question', 'fair enough',
    'fair point', 'i hear you', 'got it', 'totally', 'i see', 'great point',
    "that's fair", 'thats fair',
  ],
};

export type DrillTipKey =
  | 'drill.tip.empty'
  | 'drill.tip.acknowledge'
  | 'drill.tip.explore'
  | 'drill.tip.noRebuttal'
  | 'drill.tip.substance';

export interface ObjectionEval {
  /** 0-10 */
  score: number;
  acknowledged: boolean;
  explored: boolean;
  substantive: boolean;
  instantRebuttal: boolean;
  /** Chaves de i18n com dicas acionáveis. */
  tipKeys: DrillTipKey[];
}

export function scoreObjectionResponse(text: string, language: Language | 'pt' | 'it' | 'en'): ObjectionEval {
  const words = wordCount(text);
  if (words === 0) {
    return {
      score: 0,
      acknowledged: false,
      explored: false,
      substantive: false,
      instantRebuttal: false,
      tipKeys: ['drill.tip.empty'],
    };
  }

  const fam = langFamilyOf(language);
  // Normaliza aspas/apóstrofos curvos (comuns em teclado de celular).
  const lower = text.toLowerCase().replace(/[’‘`]/g, "'");
  const acknowledged = ACK_PHRASES[fam].some((p) => lower.includes(p));
  const explored = /\?/.test(text);
  const substantive = words >= DRILL_SUBSTANCE_WORDS;
  const instantRebuttal = !acknowledged && !explored && words <= 12;

  let score = 2; // engajou
  if (acknowledged) score += 2;
  if (explored) score += 4; // explorar antes de responder é a habilidade-chave
  if (substantive) score += 2;
  else if (words >= 4) score += 1;
  if (instantRebuttal) score = Math.min(score, 3);
  score = Math.max(0, Math.min(10, score));

  const tipKeys: DrillTipKey[] = [];
  if (instantRebuttal) tipKeys.push('drill.tip.noRebuttal');
  if (!acknowledged) tipKeys.push('drill.tip.acknowledge');
  if (!explored) tipKeys.push('drill.tip.explore');
  if (!substantive) tipKeys.push('drill.tip.substance');

  return { score, acknowledged, explored, substantive, instantRebuttal, tipKeys };
}

/**
 * Resolve a objeção no idioma da interface, caindo no texto base quando não há
 * tradução (o caso de todo produto criado pelo usuário).
 */
export function localizedObjection(o: ModelObjection, lang: UiLanguage): ModelObjection {
  const variant = o.i18n?.[lang];
  return variant ? { objection: variant.objection, model_answer: variant.model_answer } : o;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Repetição espaçada: histórico por objeção (localStorage) ----

export interface ObjectionStat {
  attempts: number;
  /** Média 0-10 das tentativas. */
  avg: number;
}

/** { [productId]: { [objeçãoBase]: {n, sum} } } */
type RawHistory = Record<string, Record<string, { n: number; sum: number }>>;

const HISTORY_KEY = 'act.drill.history';

/**
 * Chaves que, usadas como índice de um objeto comum, alcançam o protótipo.
 *
 * O id do produto e o texto da objeção são strings controladas por quem escreve
 * o produto — ou por um backup importado. Com `history[productId] ??= {}` e
 * productId === "__proto__", a expressão devolve o PRÓPRIO Object.prototype, e a
 * escrita seguinte cria propriedades em todo objeto do app (poluição de
 * protótipo). Uma objeção chamada "__proto__" faz o mesmo no nível de baixo.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function readHistory(): RawHistory {
  const raw = safeStorage.getJson<unknown>(HISTORY_KEY, {});
  return isPlainObject(raw) ? (raw as RawHistory) : {};
}

/** Entrada bem formada ({n, sum} finitos) ou undefined — nunca confia no storage. */
function cleanEntry(v: unknown): { n: number; sum: number } | undefined {
  if (!isPlainObject(v)) return undefined;
  const { n, sum } = v;
  return typeof n === 'number' && typeof sum === 'number' && Number.isFinite(n) && Number.isFinite(sum)
    ? { n, sum }
    : undefined;
}

/**
 * Estatísticas por objeção de um produto.
 *
 * A chave é o texto BASE da objeção (nunca o traduzido), para o histórico
 * sobreviver a uma troca de idioma da interface.
 */
export function getObjectionStats(productId: string): Record<string, ObjectionStat> {
  const out: Record<string, ObjectionStat> = {};
  if (UNSAFE_KEYS.has(productId)) return out;
  const history = readHistory();
  const perProduct = hasOwn(history, productId) ? history[productId] : undefined;
  if (!isPlainObject(perProduct)) return out;
  for (const [key, raw] of Object.entries(perProduct)) {
    const entry = cleanEntry(raw);
    if (UNSAFE_KEYS.has(key) || !entry || entry.n <= 0) continue;
    out[key] = { attempts: entry.n, avg: entry.sum / entry.n };
  }
  return out;
}

/** Registra o resultado de uma objeção (chave = texto base). */
export function recordObjectionResult(
  productId: string,
  baseObjection: string,
  score: number,
): void {
  // Chave perigosa: não registra (o drill funciona, só não adapta essa objeção).
  if (UNSAFE_KEYS.has(productId) || UNSAFE_KEYS.has(baseObjection)) return;
  if (!Number.isFinite(score)) return;

  const history = readHistory();
  const existing = hasOwn(history, productId) ? history[productId] : undefined;
  const perProduct: Record<string, { n: number; sum: number }> = isPlainObject(existing)
    ? (existing as Record<string, { n: number; sum: number }>)
    : {};
  const prev = hasOwn(perProduct, baseObjection) ? cleanEntry(perProduct[baseObjection]) : undefined;
  perProduct[baseObjection] = { n: (prev?.n ?? 0) + 1, sum: (prev?.sum ?? 0) + score };
  history[productId] = perProduct;
  // Storage indisponível: o drill funciona, só não adapta.
  safeStorage.setJson(HISTORY_KEY, history);
}

/**
 * Peso de sorteio: quanto pior você vai numa objeção, mais ela aparece.
 * Objeção nunca treinada tem o peso mais alto — primeiro cobrir o repertório,
 * depois insistir nas fracas.
 */
export function weightOf(stat: ObjectionStat | undefined): number {
  if (!stat || stat.attempts === 0) return 12;
  return Math.max(1, 11 - stat.avg);
}

/** Sorteio ponderado sem reposição (rnd injetável para teste determinístico). */
function sampleWeighted<T>(
  items: T[],
  weight: (item: T) => number,
  k: number,
  rnd: () => number,
): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < k && pool.length > 0) {
    const total = pool.reduce((s, i) => s + weight(i), 0);
    let r = rnd() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= weight(pool[i]);
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/**
 * Monta a rajada de um produto. Sem histórico, embaralha; com histórico, sorteia
 * com peso nas objeções que você trata pior (mantendo aleatoriedade para a
 * rajada não ficar idêntica toda vez).
 *
 * Devolve as objeções BASE — quem exibe resolve o idioma com
 * `localizedObjection`, para a chave do histórico não mudar com a interface.
 */
export function buildGauntlet(
  product: Product,
  max = DRILL_LENGTH,
  stats?: Record<string, ObjectionStat>,
  rnd: () => number = Math.random,
): ModelObjection[] {
  const list = product.common_objections;
  if (!stats || Object.keys(stats).length === 0) return shuffle(list).slice(0, max);
  return sampleWeighted(list, (o) => weightOf(stats[o.objection]), max, rnd);
}

// ---- Recorde pessoal por produto (localStorage) ----

const BEST_KEY = 'act.drill.best';

type BestMap = Record<string, number>;

/** Mapa vindo do storage, ou vazio se estiver adulterado (string, array, null...). */
function readBest(): BestMap {
  const raw = safeStorage.getJson<unknown>(BEST_KEY, {});
  return isPlainObject(raw) ? (raw as BestMap) : {};
}

export function getDrillBest(productId: string): number | null {
  if (UNSAFE_KEYS.has(productId)) return null;
  const map = readBest();
  const v = hasOwn(map, productId) ? map[productId] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Salva se for recorde. Retorna true se bateu o recorde. */
export function saveDrillBest(productId: string, avg: number): boolean {
  if (UNSAFE_KEYS.has(productId) || !Number.isFinite(avg)) return false;
  // Antes, um "act.drill.best" = "x" no storage fazia `map[id] = avg` numa
  // STRING — que lança em modo estrito e quebrava o fim do drill.
  const map = readBest();
  const prev = hasOwn(map, productId) ? map[productId] : undefined;
  if (typeof prev === 'number' && prev >= avg) return false;
  map[productId] = avg;
  safeStorage.setJson(BEST_KEY, map);
  return prev !== undefined;
}
