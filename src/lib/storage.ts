import type { Evaluation, Persona, Product, Scenario, Session, Turn } from '@/types';
import { supabase } from './supabase';
import { SEED_PRODUCTS } from '@/data/seed/products';
import { SEED_PERSONAS } from '@/data/seed/personas';
import { SEED_SCENARIOS } from '@/data/seed/scenarios';

/**
 * Camada de persistência única para o app.
 * - Com Supabase configurado: sessions/turns/evaluations vão para o Postgres.
 * - Sem Supabase (modo demo): tudo vive no localStorage.
 * Conteúdo custom da Biblioteca (produtos/personas/cenários) fica sempre no
 * localStorage — é conteúdo pessoal do dispositivo, sem necessidade de conta.
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
  if (supabase) {
    const { error } = await supabase.from('sessions').insert({
      id: session.id,
      scenario_id: session.scenario_id,
      started_at: session.started_at,
      mode: session.mode,
    });
    if (error) console.warn('supabase sessions.insert:', error.message);
  }
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
  if (supabase) {
    const { error } = await supabase
      .from('sessions')
      .update({ ended_at: endedAt, outcome })
      .eq('id', sessionId);
    if (error) console.warn('supabase sessions.update:', error.message);
  }
}

export async function saveTurn(turn: Turn): Promise<Turn> {
  upsertLs(LS_KEYS.turns, turn);
  if (supabase) {
    const { error } = await supabase.from('turns').insert(turn);
    if (error) console.warn('supabase turns.insert:', error.message);
  }
  return turn;
}

export async function saveEvaluation(evaluation: Evaluation): Promise<Evaluation> {
  upsertLs(LS_KEYS.evaluations, evaluation);
  if (supabase) {
    const { error } = await supabase.from('evaluations').insert(evaluation);
    if (error) console.warn('supabase evaluations.insert:', error.message);
  }
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
