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

function readHistory(): RawHistory {
  return safeStorage.getJson<RawHistory>(HISTORY_KEY, {});
}

/**
 * Estatísticas por objeção de um produto.
 *
 * A chave é o texto BASE da objeção (nunca o traduzido), para o histórico
 * sobreviver a uma troca de idioma da interface.
 */
export function getObjectionStats(productId: string): Record<string, ObjectionStat> {
  const perProduct = readHistory()[productId] ?? {};
  const out: Record<string, ObjectionStat> = {};
  for (const [key, { n, sum }] of Object.entries(perProduct)) {
    if (n > 0) out[key] = { attempts: n, avg: sum / n };
  }
  return out;
}

/** Registra o resultado de uma objeção (chave = texto base). */
export function recordObjectionResult(
  productId: string,
  baseObjection: string,
  score: number,
): void {
  const history = readHistory();
  const perProduct = history[productId] ?? (history[productId] = {});
  const entry = perProduct[baseObjection] ?? (perProduct[baseObjection] = { n: 0, sum: 0 });
  entry.n += 1;
  entry.sum += score;
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

export function getDrillBest(productId: string): number | null {
  const map = safeStorage.getJson<BestMap>(BEST_KEY, {});
  return typeof map[productId] === 'number' ? map[productId] : null;
}

/** Salva se for recorde. Retorna true se bateu o recorde. */
export function saveDrillBest(productId: string, avg: number): boolean {
  const map = safeStorage.getJson<BestMap>(BEST_KEY, {});
  const prev = map[productId];
  if (typeof prev === 'number' && prev >= avg) return false;
  map[productId] = avg;
  safeStorage.setJson(BEST_KEY, map);
  return prev !== undefined;
}
