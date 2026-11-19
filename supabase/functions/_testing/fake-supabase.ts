/**
 * Supabase falso, em memória — só para testar as Edge Functions fora do Deno.
 *
 * Implementa o mínimo do encadeamento do PostgREST que `_shared/common.ts` usa
 * (select/insert/delete + eq/gte/in/limit) com semântica fiel o bastante para
 * os ataques que importam:
 *
 *  - `latencyMs` faz cada operação esperar, que é o que expõe condições de
 *    corrida (check-then-insert) — com latência zero o JS é single-thread e
 *    tudo parece atômico;
 *  - `failWith` faz toda operação devolver `{ error }`, simulando banco fora do
 *    ar, tabela inexistente (migration não rodada) ou RLS mal configurada.
 *
 * É resolvido pelo alias `npm:@supabase/supabase-js@2` em vite.config.ts, então
 * o código de produção é importado SEM nenhuma alteração.
 */

type Row = Record<string, unknown>;

export interface FakeDb {
  tables: Record<string, Row[]>;
  latencyMs: number;
  failWith: string | null;
  /** Se definido, só estas operações falham (ex.: o SELECT cai depois da reserva). */
  failOnly: ('select' | 'insert' | 'delete')[] | null;
  nextId: number;
  /** Total de operações executadas — útil para provar que nada foi tentado. */
  ops: number;
}

function newDb(): FakeDb {
  return { tables: {}, latencyMs: 0, failWith: null, failOnly: null, nextId: 1, ops: 0 };
}

export function getFakeDb(): FakeDb {
  const g = globalThis as unknown as { __FAKE_DB__?: FakeDb };
  return (g.__FAKE_DB__ ??= newDb());
}

export function resetFakeDb(patch: Partial<FakeDb> = {}): FakeDb {
  const g = globalThis as unknown as { __FAKE_DB__?: FakeDb };
  g.__FAKE_DB__ = { ...newDb(), ...patch };
  return g.__FAKE_DB__;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Result = { data: Row[] | null; error: { message: string } | null };

class Query implements PromiseLike<Result> {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'insert' | 'delete' = 'select';
  private payload: Row[] = [];
  private limitN = Infinity;
  private returning = false;

  constructor(private table: string) {}

  select(_cols?: string) {
    // Depois de insert(), select() pede as linhas inseridas de volta.
    if (this.op === 'insert') this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  gte(col: string, val: unknown) {
    this.filters.push((r) => String(r[col]) >= String(val));
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }

  private async run(): Promise<Result> {
    const db = getFakeDb();
    if (db.latencyMs > 0) await sleep(db.latencyMs);
    db.ops++;
    if (db.failWith && (!db.failOnly || db.failOnly.includes(this.op))) {
      return { data: null, error: { message: db.failWith } };
    }

    const rows = (db.tables[this.table] ??= []);
    const matches = (r: Row) => this.filters.every((f) => f(r));

    if (this.op === 'insert') {
      const inserted = this.payload.map((p) => ({
        id: db.nextId++,
        created_at: new Date().toISOString(),
        ...p,
      }));
      rows.push(...inserted);
      return { data: this.returning ? inserted : null, error: null };
    }
    if (this.op === 'delete') {
      db.tables[this.table] = rows.filter((r) => !matches(r));
      return { data: null, error: null };
    }
    return { data: rows.filter(matches).slice(0, this.limitN), error: null };
  }

  then<A = Result, B = never>(
    onfulfilled?: ((v: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export function createClient(_url?: string, _key?: string) {
  return { from: (table: string) => new Query(table) };
}
