import type { Evaluation, Persona, Product, Scenario, Session, Turn } from '@/types';
import { SEED_PRODUCTS } from '@/data/seed/products';
import { SEED_PERSONAS } from '@/data/seed/personas';
import { SEED_SCENARIOS } from '@/data/seed/scenarios';
import * as safeStorage from '@/lib/safeStorage';
import {
  isEvaluation,
  isPersona,
  isProduct,
  isScenario,
  isSession,
  isTurn,
  MAX_ITEMS_PER_COLLECTION,
  sanitizeList,
} from '@/lib/schema';

/**
 * Camada de persistência única para o app.
 * - localStorage é sempre a fonte da verdade (sessions/turns/evaluations e o
 *   conteúdo custom da Biblioteca vivem aqui).
 * - A cópia na nuvem para uso multi-dispositivo é feita pelo backup por usuário
 *   (tabela user_backups, protegida por RLS em auth.uid()), não escrevendo linha
 *   a linha em tabelas abertas. Ver lib/cloudSync.ts.
 */

const LS_KEYS = {
  sessions: 'act.sessions',
  turns: 'act.turns',
  evaluations: 'act.evaluations',
  products: 'act.custom_products',
  personas: 'act.custom_personas',
  scenarios: 'act.custom_scenarios',
} as const;

/**
 * Lê uma coleção do storage SEMPRE passando por uma guarda de schema.
 *
 * O storage é entrada não confiável (backup importado, sync corrompido,
 * extensão, edição manual). Sem a guarda, um único item malformado fazia
 * `listSessions()` lançar e derrubava Home e Progresso — com o dado ruim
 * persistindo, então recarregar não resolvia. Itens inválidos são omitidos da
 * leitura e deixam de existir no próximo `writeLs` (autocura).
 */
function readLs<T>(key: string, guard: (v: unknown) => v is T): T[] {
  return sanitizeList(safeStorage.getJson<unknown>(key, []), guard);
}

/** Chaves de histórico — podáveis. O catálogo custom do usuário nunca é podado. */
const HISTORY_KEYS = [LS_KEYS.sessions, LS_KEYS.turns, LS_KEYS.evaluations] as const;

/**
 * Máximo de calls retidas. localStorage dá ~5 MB por origem e o transcript é o
 * grosso do peso; 200 calls cabem com folga e mantêm os gráficos de progresso
 * significativos. Acima disso, as mais antigas saem (ver `pruneHistory`).
 */
export const MAX_SESSIONS = 200;

/**
 * Mantém só as `max` calls mais recentes e descarta turnos/avaliações órfãos.
 * Devolve quantas linhas saíram de cada coleção.
 *
 * Chamado de forma proativa ao salvar e como último recurso quando a cota
 * estoura — assim uma call nova nunca é perdida por causa das antigas.
 */
export function pruneHistory(max = MAX_SESSIONS): {
  sessions: number;
  turns: number;
  evaluations: number;
} {
  const sessions = readLs(LS_KEYS.sessions, isSession);
  if (sessions.length <= max) return { sessions: 0, turns: 0, evaluations: 0 };

  // Mais recentes primeiro; sessões sem data vão para o fim (saem primeiro).
  const kept = [...sessions]
    .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''))
    .slice(0, max);
  const keptIds = new Set(kept.map((s) => s.id));

  const turns = readLs(LS_KEYS.turns, isTurn);
  const evaluations = readLs(LS_KEYS.evaluations, isEvaluation);
  const keptTurns = turns.filter((t) => keptIds.has(t.session_id));
  const keptEvals = evaluations.filter((e) => keptIds.has(e.session_id));

  safeStorage.setJson(LS_KEYS.sessions, kept);
  safeStorage.setJson(LS_KEYS.turns, keptTurns);
  safeStorage.setJson(LS_KEYS.evaluations, keptEvals);

  return {
    sessions: sessions.length - kept.length,
    turns: turns.length - keptTurns.length,
    evaluations: evaluations.length - keptEvals.length,
  };
}

/**
 * Grava uma coleção. Devolve `true` se persistiu.
 *
 * Se a cota estourar numa chave de histórico, poda pela metade e tenta de novo
 * — perder as calls mais antigas é muito melhor que perder a que acabou de
 * acontecer. Em storage bloqueado devolve `false` sem lançar: o app segue
 * funcionando na memória da sessão.
 */
function writeLs<T>(key: string, items: T[]): boolean {
  if (safeStorage.setJson(key, items)) return true;
  if (!(HISTORY_KEYS as readonly string[]).includes(key)) return false;

  const sessionCount = readLs(LS_KEYS.sessions, isSession).length;
  if (sessionCount < 2) return false; // nada a podar: é o storage que está negado
  pruneHistory(Math.floor(sessionCount / 2));
  return safeStorage.setJson(key, items);
}

function upsertLs<T extends { id: string }>(
  key: string,
  item: T,
  guard: (v: unknown) => v is T,
): T {
  const items = readLs(key, guard);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.push(item);
  writeLs(key, items);
  return item;
}

// ---------- Catálogo (seed + custom) ----------

/** Ids do catálogo embutido — nenhum item do usuário (ou de backup) pode usá-los. */
const SEED_IDS: ReadonlySet<string> = new Set([
  ...SEED_PRODUCTS.map((p) => p.id),
  ...SEED_PERSONAS.map((p) => p.id),
  ...SEED_SCENARIOS.map((s) => s.id),
]);

/**
 * Itens do usuário, sem os que colidem com o catálogo embutido. Sem esse filtro
 * um backup com o id de um produto oficial o substituiria (ou duplicaria) por uma
 * versão adulterada — por exemplo, objeções com instruções falsas.
 */
const customOnly = <T extends { id: string }>(items: T[]): T[] =>
  items.filter((i) => !SEED_IDS.has(i.id));

export function listProducts(): Product[] {
  return [...SEED_PRODUCTS, ...customOnly(readLs(LS_KEYS.products, isProduct))];
}

export function listPersonas(): Persona[] {
  return [...SEED_PERSONAS, ...customOnly(readLs(LS_KEYS.personas, isPersona))];
}

export function listScenarios(): Scenario[] {
  return [...SEED_SCENARIOS, ...customOnly(readLs(LS_KEYS.scenarios, isScenario))];
}

export function getProduct(id: string): Product | undefined {
  return listProducts().find((p) => p.id === id);
}

export function getPersona(id: string): Persona | undefined {
  return listPersonas().find((p) => p.id === id);
}

export function getScenario(id: string): Scenario | undefined {
  return listScenarios().find((s) => s.id === id);
}

export function saveCustomProduct(product: Product): Product {
  return upsertLs(LS_KEYS.products, { ...product, custom: true }, isProduct);
}

export function saveCustomPersona(persona: Persona): Persona {
  return upsertLs(LS_KEYS.personas, { ...persona, custom: true }, isPersona);
}

export function saveCustomScenario(scenario: Scenario): Scenario {
  return upsertLs(LS_KEYS.scenarios, { ...scenario, custom: true }, isScenario);
}

export function deleteCustom(kind: 'products' | 'personas' | 'scenarios', id: string): void {
  const key = LS_KEYS[kind];
  // As três guardas validam tipos diferentes; aqui só o `id` importa.
  const guard = { products: isProduct, personas: isPersona, scenarios: isScenario }[
    kind
  ] as (v: unknown) => v is { id: string };
  writeLs(
    key,
    readLs(key, guard).filter((i) => i.id !== id),
  );
}

// ---------- Sessões / turnos / avaliações ----------

export async function createSession(session: Session): Promise<Session> {
  upsertLs(LS_KEYS.sessions, session, isSession);
  // Poda no começo da call, não no fim: aqui uma falha de cota ainda não custa
  // nada ao usuário, e libera espaço para o transcript que está por vir.
  pruneHistory();
  return session;
}

export async function finishSession(
  sessionId: string,
  endedAt: string,
  outcome: Session['outcome'],
): Promise<void> {
  const sessions = readLs(LS_KEYS.sessions, isSession);
  const s = sessions.find((x) => x.id === sessionId);
  if (s) {
    s.ended_at = endedAt;
    s.outcome = outcome;
    writeLs(LS_KEYS.sessions, sessions);
  }
}

export async function saveTurn(turn: Turn): Promise<Turn> {
  upsertLs(LS_KEYS.turns, turn, isTurn);
  return turn;
}

export async function saveEvaluation(evaluation: Evaluation): Promise<Evaluation> {
  upsertLs(LS_KEYS.evaluations, evaluation, isEvaluation);
  return evaluation;
}

export function listSessions(): Session[] {
  return readLs(LS_KEYS.sessions, isSession).sort((a, b) =>
    b.started_at.localeCompare(a.started_at),
  );
}

export function listTurns(sessionId: string): Turn[] {
  return readLs(LS_KEYS.turns, isTurn)
    .filter((t) => t.session_id === sessionId)
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

export function listEvaluations(): Evaluation[] {
  return readLs(LS_KEYS.evaluations, isEvaluation).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

export function getEvaluationBySession(sessionId: string): Evaluation | undefined {
  return readLs(LS_KEYS.evaluations, isEvaluation).find((e) => e.session_id === sessionId);
}

export function getSession(sessionId: string): Session | undefined {
  return readLs(LS_KEYS.sessions, isSession).find((s) => s.id === sessionId);
}

// ---------- Backup / restore ----------

/** Everything this device stores, in one portable object. */
export interface Backup {
  version: 1;
  exported_at: string;
  sessions: Session[];
  turns: Turn[];
  evaluations: Evaluation[];
  products: Product[];
  personas: Persona[];
  scenarios: Scenario[];
}

export function readBackup(): Backup {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    sessions: readLs(LS_KEYS.sessions, isSession),
    turns: readLs(LS_KEYS.turns, isTurn),
    evaluations: readLs(LS_KEYS.evaluations, isEvaluation),
    products: readLs(LS_KEYS.products, isProduct),
    personas: readLs(LS_KEYS.personas, isPersona),
    scenarios: readLs(LS_KEYS.scenarios, isScenario),
  };
}

/**
 * Merges by id — importing the same backup twice never duplicates rows.
 *
 * `incoming` é ENTRADA NÃO CONFIÁVEL: passa pela guarda de schema (item a item,
 * com teto de quantidade) antes de tocar o storage. Itens inválidos são
 * descartados em silêncio; um backup meio ruim ainda importa o que presta.
 * `protectedIds` impede que o backup substitua o catálogo embutido.
 */
function mergeById<T extends { id: string }>(
  key: string,
  incoming: unknown,
  guard: (v: unknown) => v is T,
  opts: { protectedIds?: ReadonlySet<string>; markCustom?: boolean } = {},
): number {
  const clean = sanitizeList(incoming, guard).filter((i) => !opts.protectedIds?.has(i.id));
  if (clean.length === 0) return 0;

  const byId = new Map(readLs(key, guard).map((item) => [item.id, item]));
  let added = 0;
  for (const item of clean) {
    if (!byId.has(item.id)) added++;
    // Catálogo importado é sempre "do usuário", nunca "embutido".
    byId.set(item.id, opts.markCustom ? ({ ...item, custom: true } as T) : item);
  }
  writeLs(key, [...byId.values()].slice(0, MAX_ITEMS_PER_COLLECTION));
  return added;
}

/** Restores a backup into localStorage. Returns how many new sessions landed. */
export function restoreBackup(backup: Partial<Backup>): number {
  // Um backup pode chegar como qualquer coisa (arquivo, nuvem): só objetos servem.
  if (!backup || typeof backup !== 'object') return 0;
  const sessions = mergeById(LS_KEYS.sessions, backup.sessions, isSession);
  mergeById(LS_KEYS.turns, backup.turns, isTurn);
  mergeById(LS_KEYS.evaluations, backup.evaluations, isEvaluation);
  const catalog = { protectedIds: SEED_IDS, markCustom: true };
  mergeById(LS_KEYS.products, backup.products, isProduct, catalog);
  mergeById(LS_KEYS.personas, backup.personas, isPersona, catalog);
  mergeById(LS_KEYS.scenarios, backup.scenarios, isScenario, catalog);
  return sessions;
}
