import type { Language, ModelObjection, Product } from '@/types';
import { langFamilyOf, wordCount } from './metrics';

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
  const substantive = words >= 8;
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Monta a rajada de objeções de um produto (embaralhada). */
export function buildGauntlet(product: Product, max = 5): ModelObjection[] {
  return shuffle(product.common_objections).slice(0, max);
}

// ---- Recorde pessoal por produto (localStorage) ----

const BEST_KEY = 'act.drill.best';

export function getDrillBest(productId: string): number | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return typeof map[productId] === 'number' ? map[productId] : null;
  } catch {
    return null;
  }
}

/** Salva se for recorde. Retorna true se bateu o recorde. */
export function saveDrillBest(productId: string, avg: number): boolean {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const prev = map[productId];
    if (typeof prev === 'number' && prev >= avg) return false;
    map[productId] = avg;
    localStorage.setItem(BEST_KEY, JSON.stringify(map));
    return prev !== undefined;
  } catch {
    return false;
  }
}
