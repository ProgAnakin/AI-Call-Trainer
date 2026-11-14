import type { Evaluation, Persona, Product, Scenario, Session, Turn } from '@/types';
import { SEED_PRODUCTS } from '@/data/seed/products';
import { SEED_PERSONAS } from '@/data/seed/personas';
import { SEED_SCENARIOS } from '@/data/seed/scenarios';
import * as safeStorage from '@/lib/safeStorage';

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

function readLs<T>(key: string): T[] {
  const items = safeStorage.getJson<T[]>(key, []);
  return Array.isArray(items) ? items : [];
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
  const sessions = readLs<Session>(LS_KEYS.sessions);
  if (sessions.length <= max) return { sessions: 0, turns: 0, evaluations: 0 };

  // Mais recentes primeiro; sessões sem data vão para o fim (saem primeiro).
  const kept = [...sessions]
    .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''))
    .slice(0, max);
  const keptIds = new Set(kept.map((s) => s.id));

  const turns = readLs<Turn>(LS_KEYS.turns);
  const evaluations = readLs<Evaluation>(LS_KEYS.evaluations);
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

  const sessionCount = readLs<Session>(LS_KEYS.sessions).length;
  if (sessionCount < 2) return false; // nada a podar: é o storage que está negado
  pruneHistory(Math.floor(sessionCount / 2));
  return safeStorage.setJson(key, items);
}

function upsertLs<T extends { id: string }>(key: string, item: T): T {
  const items = readLs<T>(key);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.push(item);
  writeLs(key, items);
  return item;
}

// ---------- Catálogo (seed + custom) ----------

export function listProducts(): Product[] {
  return [...SEED_PRODUCTS, ...readLs<Product>(LS_KEYS.products)];
}

export function listPersonas(): Persona[] {
  return [...SEED_PERSONAS, ...readLs<Persona>(LS_KEYS.personas)];
}

export function listScenarios(): Scenario[] {
  return [...SEED_SCENARIOS, ...readLs<Scenario>(LS_KEYS.scenarios)];
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
  return upsertLs(LS_KEYS.products, { ...product, custom: true });
}

export function saveCustomPersona(persona: Persona): Persona {
  return upsertLs(LS_KEYS.personas, { ...persona, custom: true });
}

export function saveCustomScenario(scenario: Scenario): Scenario {
  return upsertLs(LS_KEYS.scenarios, { ...scenario, custom: true });
}

export function deleteCustom(kind: 'products' | 'personas' | 'scenarios', id: string): void {
  const key = LS_KEYS[kind];
  writeLs(
    key,
    readLs<{ id: string }>(key).filter((i) => i.id !== id),
  );
}

// ---------- Sessões / turnos / avaliações ----------

export async function createSession(session: Session): Promise<Session> {
  upsertLs(LS_KEYS.sessions, session);
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
  const sessions = readLs<Session>(LS_KEYS.sessions);
  const s = sessions.find((x) => x.id === sessionId);
  if (s) {
    s.ended_at = endedAt;
    s.outcome = outcome;
    writeLs(LS_KEYS.sessions, sessions);
  }
}

export async function saveTurn(turn: Turn): Promise<Turn> {
  upsertLs(LS_KEYS.turns, turn);
  return turn;
}

export async function saveEvaluation(evaluation: Evaluation): Promise<Evaluation> {
  upsertLs(LS_KEYS.evaluations, evaluation);
  return evaluation;
}

export function listSessions(): Session[] {
  return readLs<Session>(LS_KEYS.sessions).sort((a, b) =>
    b.started_at.localeCompare(a.started_at),
  );
}

export function listTurns(sessionId: string): Turn[] {
  return readLs<Turn>(LS_KEYS.turns)
    .filter((t) => t.session_id === sessionId)
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

export function listEvaluations(): Evaluation[] {
  return readLs<Evaluation>(LS_KEYS.evaluations).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

export function getEvaluationBySession(sessionId: string): Evaluation | undefined {
  return readLs<Evaluation>(LS_KEYS.evaluations).find((e) => e.session_id === sessionId);
}

export function getSession(sessionId: string): Session | undefined {
  return readLs<Session>(LS_KEYS.sessions).find((s) => s.id === sessionId);
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
    sessions: readLs<Session>(LS_KEYS.sessions),
    turns: readLs<Turn>(LS_KEYS.turns),
    evaluations: readLs<Evaluation>(LS_KEYS.evaluations),
    products: readLs<Product>(LS_KEYS.products),
    personas: readLs<Persona>(LS_KEYS.personas),
    scenarios: readLs<Scenario>(LS_KEYS.scenarios),
  };
}

/** Merges by id — importing the same backup twice never duplicates rows. */
function mergeById<T extends { id: string }>(key: string, incoming: T[] | undefined): number {
  if (!Array.isArray(incoming) || incoming.length === 0) return 0;
  const existing = readLs<T>(key);
  const byId = new Map(existing.map((item) => [item.id, item]));
  let added = 0;
  for (const item of incoming) {
    if (!item || typeof item.id !== 'string') continue;
    if (!byId.has(item.id)) added++;
    byId.set(item.id, item);
  }
  writeLs(key, [...byId.values()]);
  return added;
}

/** Restores a backup into localStorage. Returns how many new sessions landed. */
export function restoreBackup(backup: Partial<Backup>): number {
  const sessions = mergeById(LS_KEYS.sessions, backup.sessions);
  mergeById(LS_KEYS.turns, backup.turns);
  mergeById(LS_KEYS.evaluations, backup.evaluations);
  mergeById(LS_KEYS.products, backup.products);
  mergeById(LS_KEYS.personas, backup.personas);
  mergeById(LS_KEYS.scenarios, backup.scenarios);
  return sessions;
}
