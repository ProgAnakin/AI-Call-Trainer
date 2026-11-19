/**
 * Lint estático das migrations: aplica 0001 → 0003 EM ORDEM, só no texto, e
 * verifica o estado final das policies de RLS.
 *
 * O que isto PROVA: o SQL do repositório, aplicado como está, não deixa nenhuma
 * tabela exposta. O que NÃO prova: o estado de um projeto Supabase real — se
 * alguém mexeu no painel, rodou só a 0001 ou criou policies à mão, o banco vivo
 * pode ser diferente. Por isso o guia de ativação manda rodar as TRÊS migrations
 * e conferir em Authentication → Policies.
 *
 * Por que existe: a policy `for all using (true) with check (true)` da 0001 deixou
 * sessions/turns/evaluations legíveis e graváveis por qualquer um com a anon key
 * (que fica no JavaScript do site). Foi achada numa auditoria, corrigida na 0003,
 * e nada impedia que voltasse.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(__dirname, 'migrations');
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

/** Remove comentários de linha e de bloco, para não casar SQL "comentado". */
const stripComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');

interface Policy {
  name: string;
  table: string;
  op: string; // select | insert | update | delete | all
  body: string;
}

interface State {
  tables: Set<string>;
  rls: Set<string>;
  policies: Map<string, Policy>; // "tabela.nome" → policy
}

function apply(): State {
  const st: State = { tables: new Set(), rls: new Set(), policies: new Map() };
  for (const f of files) {
    const sql = stripComments(readFileSync(join(DIR, f), 'utf8'));
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/gi)) {
      st.tables.add(m[1].toLowerCase());
    }
    for (const m of sql.matchAll(/alter\s+table\s+(\w+)\s+enable\s+row\s+level\s+security/gi)) {
      st.rls.add(m[1].toLowerCase());
    }
    for (const m of sql.matchAll(
      /create\s+policy\s+(\w+)\s+on\s+(\w+)\s+for\s+(\w+)([\s\S]*?);/gi,
    )) {
      const [, name, table, op, body] = m;
      st.policies.set(`${table.toLowerCase()}.${name.toLowerCase()}`, {
        name: name.toLowerCase(),
        table: table.toLowerCase(),
        op: op.toLowerCase(),
        body: body.toLowerCase().replace(/\s+/g, ' ').trim(),
      });
    }
    for (const m of sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?(\w+)\s+on\s+(\w+)/gi)) {
      st.policies.delete(`${m[2].toLowerCase()}.${m[1].toLowerCase()}`);
    }
  }
  return st;
}

const state = apply();
const WRITE_OPS = new Set(['insert', 'update', 'delete', 'all']);
const policiesOn = (t: string) => [...state.policies.values()].filter((p) => p.table === t);

describe('migrations — estado final das policies (0001 → 0003 em ordem)', () => {
  it('encontra as três migrations esperadas', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files.join(',')).toMatch(/0001.*0002.*0003/);
  });

  it('toda tabela criada tem RLS habilitada', () => {
    // Sem RLS, a anon key acessa a tabela inteira pela API REST do Supabase.
    const semRls = [...state.tables].filter((t) => !state.rls.has(t));
    expect(semRls).toEqual([]);
  });

  it.each(['sessions', 'turns', 'evaluations', 'usage_events'])(
    'tabela %s: nenhuma policy de escrita sobra (a anon key não toca nela)',
    (table) => {
      // usage_events guarda o controle de custo: se a anon key escrevesse nela,
      // qualquer um zeraria o próprio contador. Só a service role (Edge
      // Functions) deve alcançá-la — o que é o estado "RLS ligada, sem policy".
      expect(policiesOn(table).map((p) => `${p.name}:${p.op}`)).toEqual([]);
    },
  );

  it('nenhuma policy de ESCRITA usa `using (true)` ou `with check (true)`', () => {
    const abertas = [...state.policies.values()].filter(
      (p) => WRITE_OPS.has(p.op) && /\((\s*)true(\s*)\)/.test(p.body),
    );
    expect(abertas.map((p) => `${p.table}.${p.name}`)).toEqual([]);
  });

  it('o catálogo público (products/personas/scenarios) é só-leitura', () => {
    for (const t of ['products', 'personas', 'scenarios']) {
      const writes = policiesOn(t).filter((p) => WRITE_OPS.has(p.op));
      expect(writes.map((p) => p.name), t).toEqual([]);
    }
  });

  it('user_backups: toda policy amarra a linha ao dono (auth.uid() = user_id)', () => {
    const ps = policiesOn('user_backups');
    expect(ps.length).toBeGreaterThanOrEqual(4); // select, insert, update, delete
    for (const p of ps) {
      expect(p.body, `${p.name} não restringe ao dono`).toMatch(/auth\.uid\(\)\s*=\s*user_id/);
    }
    // update precisa de USING *e* WITH CHECK: só o primeiro deixaria o dono
    // reatribuir a linha para o user_id de outra pessoa.
    const update = ps.find((p) => p.op === 'update');
    expect(update?.body).toMatch(/using[^;]*auth\.uid\(\)\s*=\s*user_id/);
    expect(update?.body).toMatch(/with check[^;]*auth\.uid\(\)\s*=\s*user_id/);
    // insert idem: sem WITH CHECK dá para inserir linha em nome de outro.
    expect(ps.find((p) => p.op === 'insert')?.body).toMatch(/with check/);
  });

  it('nenhuma migration concede privilégios ao papel anon ou public', () => {
    for (const f of files) {
      const sql = stripComments(readFileSync(join(DIR, f), 'utf8')).toLowerCase();
      expect(sql, `${f} concede acesso amplo`).not.toMatch(/grant\s+[^;]*\sto\s+(anon|public)\b/);
    }
  });

  it('nenhuma função SECURITY DEFINER (rodaria com os privilégios do dono)', () => {
    for (const f of files) {
      const sql = stripComments(readFileSync(join(DIR, f), 'utf8')).toLowerCase();
      expect(sql, f).not.toMatch(/security\s+definer/);
    }
  });

  it('o tamanho do backup sincronizado é limitado no banco (anti abuso de storage)', () => {
    const all = files.map((f) => readFileSync(join(DIR, f), 'utf8')).join('\n');
    expect(all).toMatch(/user_backups_size[\s\S]*pg_column_size/);
  });

  it('o schema de contagem de uso suporta a reserva/rollback do limitador', () => {
    // O limitador grava a reserva, lê o id de volta (.select('id')) e remove a
    // linha ao recusar. Isso exige a coluna `id` e a coluna `kind` restrita.
    const init = stripComments(readFileSync(join(DIR, files[0]), 'utf8')).toLowerCase();
    const usage = init.match(/create table[^;]*usage_events\s*\(([\s\S]*?)\);/)?.[1] ?? '';
    expect(usage).toMatch(/\bid\b/);
    expect(usage).toMatch(/kind[^,]*check\s*\(kind in \('roleplay_call','evaluate'\)\)/);
    expect(usage).toMatch(/device_id\s+text/);
  });
});
