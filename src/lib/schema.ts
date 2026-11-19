/**
 * Guardas de tipo para tudo que o app lê do localStorage ou de um backup.
 *
 * POR QUE EXISTE. O localStorage e os arquivos de backup são ENTRADA NÃO
 * CONFIÁVEL: um backup baixado de algum lugar, uma sincronização corrompida, uma
 * extensão do navegador, o próprio usuário mexendo. Antes, a camada de storage
 * só checava `typeof id === 'string'`. Uma sessão sem `started_at` fazia
 * `listSessions()` lançar `Cannot read properties of undefined (reading
 * 'localeCompare')`; como Home e Progresso a chamam, o app abria em tela de erro
 * — e como o dado ruim fica no storage, recarregar não resolvia, e as telas com
 * exportar/importar/apagar eram justamente as que caíam.
 *
 * O CRITÉRIO é "o que faria a UI lançar exceção", NÃO "o que o tipo TypeScript
 * declara". A diferença importa: o /evaluate repassa o que o LLM devolveu, e o
 * LLM pode omitir `quote` ou `comment`. Um validador que exigisse todos os
 * campos descartaria scorecards legítimos e o usuário perderia histórico.
 * Então: campos de texto são `string | undefined` (a UI renderiza vazio); o que a
 * UI ordena, soma, mapeia ou usa como chave é exigido com o tipo certo.
 */
import type {
  CallType,
  Evaluation,
  Language,
  Persona,
  Product,
  Scenario,
  Session,
  Turn,
} from '@/types';

/** Teto de itens por coleção — um backup de milhões não pode encher o storage. */
export const MAX_ITEMS_PER_COLLECTION = 5_000;
/** Maior string aceita em um campo (uma call longa cabe com folga). */
const MAX_STR = 100_000;
/** Tamanho máximo de um arquivo de backup importado (o localStorage dá ~5 MB). */
export const MAX_IMPORT_BYTES = 10_000_000;

/** Chaves que, usadas como índice de objeto comum, alcançam o protótipo. */
export const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

const LANGS: readonly Language[] = ['pt-BR', 'pt-PT', 'it-IT', 'en-US'];
const CALL_TYPES: readonly CallType[] = ['cold_call', 'discovery', 'demo', 'negotiation'];
const BUYING_STAGES = ['cold', 'aware', 'evaluating'] as const;
const SPEAKERS = ['rep', 'prospect'] as const;
const MODES = ['text', 'voice'] as const;
const OUTCOMES = ['meeting_booked', 'rejected', 'abandoned'] as const;
const FRAMEWORK_IDS = ['basic', 'SPICED', 'MEDDIC'] as const;
const QUALITIES = ['ignored', 'rebutted', 'handled'] as const;

// ---------- primitivas ----------

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, max = MAX_STR): v is string => typeof v === 'string' && v.length <= max;
/** Texto opcional: ausente é aceito; presente tem de ser string (um objeto quebra o React). */
const optStr = (v: unknown, max = MAX_STR): boolean => v === undefined || str(v, max);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

/** Id seguro: string não vazia, curta e que não seja uma chave de protótipo. */
export const isSafeId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= 128 && !UNSAFE_KEYS.has(v);

/** Data ISO parseável — listSessions/listTurns ordenam com localeCompare. */
const isIso = (v: unknown): v is string => str(v, 64) && Number.isFinite(Date.parse(v));

const listOf = (v: unknown, item: (x: unknown) => boolean, max = 1_000): boolean =>
  Array.isArray(v) && v.length <= max && v.every(item);
const stringList = (v: unknown, max = 200): boolean => listOf(v, (s) => str(s, 5_000), max);

// ---------- entidades ----------

export function isSession(v: unknown): v is Session {
  return (
    isRecord(v) &&
    isSafeId(v.id) &&
    str(v.scenario_id, 128) &&
    isIso(v.started_at) &&
    (v.ended_at == null || isIso(v.ended_at)) &&
    (v.mode === undefined || oneOf(MODES, v.mode)) &&
    (v.outcome == null || oneOf(OUTCOMES, v.outcome))
  );
}

export function isTurn(v: unknown): v is Turn {
  return (
    isRecord(v) &&
    isSafeId(v.id) &&
    isSafeId(v.session_id) &&
    oneOf(SPEAKERS, v.speaker) &&
    str(v.content) &&
    isIso(v.ts)
  );
}

export function isEvaluation(v: unknown): v is Evaluation {
  if (!isRecord(v) || !isSafeId(v.id) || !isSafeId(v.session_id)) return false;
  if (!num(v.overall_score) || !isIso(v.created_at)) return false;
  if (v.framework !== undefined && !oneOf(FRAMEWORK_IDS, v.framework)) return false;

  // scores: a UI faz `scores[chave]`, e soma/ordena os `score`.
  if (!isRecord(v.scores)) return false;
  for (const [k, s] of Object.entries(v.scores)) {
    if (UNSAFE_KEYS.has(k) || !isRecord(s) || !num(s.score) || !optStr(s.comment)) return false;
  }

  // Item de lista: só `null`/`undefined` derrubam a UI (`x.point` lança). Uma
  // STRING no lugar do objeto — que o LLM às vezes devolve — renderiza vazio, e
  // rejeitá-la faria o scorecard de uma call real recém-terminada sumir.
  const item = (fields: string[]) => (x: unknown) =>
    x !== null && x !== undefined && (!isRecord(x) || fields.every((f) => optStr(x[f])));
  if (!listOf(v.strengths, item(['point', 'quote']))) return false;
  if (!listOf(v.improvements, item(['point', 'instead_try']))) return false;
  if (v.objection_handling !== undefined) {
    if (!listOf(v.objection_handling, item(['objection', 'quality', 'comment']))) return false;
    // `quality` indexa um dicionário de estilos: tem de ser uma das três (o
    // servidor já normaliza para uma delas; aqui só barra dado adulterado).
    const bad = (v.objection_handling as unknown[]).some(
      (o) => isRecord(o) && o.quality !== undefined && !oneOf(QUALITIES, o.quality),
    );
    if (bad) return false;
  }
  if (v.missed_signals !== undefined && !listOf(v.missed_signals, item(['quote', 'note']))) {
    return false;
  }
  return ['talk_ratio_estimate', 'focus_next', 'opener_rewrite', 'best_line', 'worst_line'].every(
    (f) => optStr(v[f]),
  );
}

export function isProduct(v: unknown): v is Product {
  return (
    isRecord(v) &&
    isSafeId(v.id) &&
    str(v.name, 500) &&
    optStr(v.vendor, 500) &&
    optStr(v.one_liner, 2_000) &&
    optStr(v.pricing_notes, 5_000) &&
    listOf(v.key_features, (x) => isRecord(x) && optStr(x.feature) && optStr(x.benefit)) &&
    listOf(
      v.common_objections,
      // `objection` é chave de histórico e de lista no React: string obrigatória.
      (x) =>
        isRecord(x) &&
        str(x.objection, 5_000) &&
        optStr(x.model_answer) &&
        (x.i18n === undefined || isRecord(x.i18n)),
    ) &&
    listOf(v.competitors, (x) => isRecord(x) && optStr(x.name) && optStr(x.key_difference))
  );
}

export function isPersona(v: unknown): v is Persona {
  return (
    isRecord(v) &&
    isSafeId(v.id) &&
    str(v.name, 500) &&
    optStr(v.role, 500) &&
    optStr(v.company_profile, 5_000) &&
    isRecord(v.personality) &&
    num(v.personality.skepticism) &&
    num(v.personality.patience) &&
    num(v.personality.talkativeness) &&
    stringList(v.pain_points) &&
    stringList(v.hidden_objections) &&
    oneOf(BUYING_STAGES, v.buying_stage)
  );
}

export function isScenario(v: unknown): v is Scenario {
  return (
    isRecord(v) &&
    isSafeId(v.id) &&
    isSafeId(v.persona_id) &&
    isSafeId(v.product_id) &&
    oneOf(CALL_TYPES, v.call_type) &&
    Number.isInteger(v.difficulty) &&
    (v.difficulty as number) >= 1 &&
    (v.difficulty as number) <= 5 &&
    oneOf(LANGS, v.language) &&
    num(v.time_limit_seconds) &&
    optStr(v.success_criteria, 5_000)
  );
}

/**
 * Filtra uma coleção crua: não-array vira lista vazia, o excesso é cortado e
 * cada item precisa passar na guarda. Nunca lança.
 */
export function sanitizeList<T>(raw: unknown, guard: (v: unknown) => v is T): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw.slice(0, MAX_ITEMS_PER_COLLECTION)) {
    if (guard(item)) out.push(item);
  }
  return out;
}
