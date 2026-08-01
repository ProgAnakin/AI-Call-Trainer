import type { Evaluation, Persona, Product, Scenario, Session, Turn } from '@/types';
import { SEED_PRODUCTS } from '@/data/seed/products';
import { SEED_PERSONAS } from '@/data/seed/personas';
import { SEED_SCENARIOS } from '@/data/seed/scenarios';

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
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLs<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
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
