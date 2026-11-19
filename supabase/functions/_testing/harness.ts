/**
 * Ambiente para atacar as Edge Functions sem Deno.
 *
 * Instala um `Deno` mínimo (env + serve), um Supabase falso e uma API da
 * Anthropic falsa que REGISTRA tudo que o servidor tentaria enviar — é assim que
 * dá para provar o que o código gastaria, em vez de supor.
 */
import { vi } from 'vitest';
import { resetFakeDb, type FakeDb } from './fake-supabase';

export const ANTHROPIC_KEY = 'sk-ant-TEST-SECRET-must-never-leak-0123456789';
export const EVIL_ORIGIN = 'https://evil.example';

export type Handler = (req: Request) => Promise<Response>;

export interface AnthropicCall {
  url: string;
  headers: Record<string, string>;
  body: {
    model: string;
    system: string;
    messages: { role: string; content: unknown }[];
    max_tokens: number;
    temperature: number;
  };
  /** Tamanho do JSON enviado — proxy direto do custo em tokens de entrada. */
  bytes: number;
}

export interface Harness {
  handler: Handler;
  anthropic: AnthropicCall[];
  db: FakeDb;
  /** Próxima resposta do "Claude" — troque para simular saídas hostis. */
  setReply(text: string | (() => string | Response)): void;
  post(body: unknown, init?: { headers?: Record<string, string>; raw?: string }): Promise<Response>;
}

export type Target = 'functions' | 'dashboard-deploy';

interface Options {
  fn: 'roleplay' | 'evaluate';
  /**
   * `functions` = código canônico (supabase functions deploy).
   * `dashboard-deploy` = os arquivos ÚNICOS gerados por build.mjs, que são o que
   * quem usa o painel do Supabase cola em produção. Mesmo ataque nos dois.
   */
  target?: Target;
  env?: Record<string, string>;
  latencyMs?: number;
}

/** Carrega a função do zero, com env próprio, sem alterar o código de produção. */
export async function load({ fn, env = {}, latencyMs = 0, target = 'functions' }: Options): Promise<Harness> {
  vi.resetModules();
  const db = resetFakeDb({ latencyMs });

  const fullEnv: Record<string, string> = {
    ANTHROPIC_API_KEY: ANTHROPIC_KEY,
    SUPABASE_URL: 'http://fake.local',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-fake',
    ...env,
  };
  let handler: Handler | undefined;
  (globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: (k: string) => fullEnv[k] },
    serve: (h: Handler) => {
      handler = h;
      return {};
    },
  };

  const anthropic: AnthropicCall[] = [];
  let reply: string | (() => string | Response) = 'Ok, tell me more.';
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const raw = String(init.body);
    anthropic.push({
      url: String(url),
      headers: init.headers as Record<string, string>,
      body: JSON.parse(raw),
      bytes: raw.length,
    });
    const out = typeof reply === 'function' ? reply() : reply;
    if (out instanceof Response) return out;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: out }] }), { status: 200 });
  });

  await import(target === 'functions' ? `../${fn}/index.ts` : `../../dashboard-deploy/${fn}.ts`);
  if (!handler) throw new Error(`a função ${fn} não registrou um handler via Deno.serve`);
  const h = handler;

  return {
    handler: h,
    anthropic,
    db,
    setReply: (r) => {
      reply = r;
    },
    post: (body, init = {}) =>
      h(
        new Request(`https://project.supabase.co/functions/v1/${fn}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...init.headers },
          body: init.raw ?? JSON.stringify(body),
        }),
      ),
  };
}

export function unload(): void {
  vi.unstubAllGlobals();
  delete (globalThis as unknown as { Deno?: unknown }).Deno;
}
