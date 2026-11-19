// Utilidades compartilhadas pelas Edge Functions (Deno runtime).
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Origin allowlist. Set the `ALLOWED_ORIGINS` secret to a comma-separated list
 * of your exact site origins for the tightest policy, e.g.
 *   supabase secrets set ALLOWED_ORIGINS=https://your-app.vercel.app
 * localhost is always allowed for development; when the secret is unset we fall
 * back to any *.vercel.app deployment so the app keeps working out of the box.
 */
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false; // inclui o literal "null" de iframes em sandbox e file://
  }
  const host = url.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return true; // dev
  if (ALLOWED_ORIGINS.length > 0) return ALLOWED_ORIGINS.includes(origin);
  // Fallback permissivo até ALLOWED_ORIGINS ser definido. Exige HTTPS: aceitar
  // http:// permitiria uma página servida sem TLS (MITM, rede aberta) falar com a API.
  return url.protocol === 'https:' && host.endsWith('.vercel.app');
}

/**
 * Per-request CORS headers.
 *
 * Origem não permitida => o header Access-Control-Allow-Origin é OMITIDO. Antes
 * o código devolvia a string literal "null" para negar, mas isso não nega nada:
 * "null" é justamente o valor que o navegador envia como Origin em iframes com
 * sandbox e em arquivos file://, então uma página hostil nesses contextos
 * recebia permissão. Sem o header, o navegador bloqueia por padrão.
 */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

/** Só caracteres de IPv4/IPv6 — qualquer outra coisa não vira chave de contador. */
const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * IP do cliente, ou 'unknown'.
 *
 * `cf-connecting-ip` tem prioridade: é definido pela borda e o cliente não
 * consegue forjá-lo. `x-forwarded-for` só entra como fallback, e seu primeiro
 * valor é o que o PRÓPRIO cliente mandar se o proxy anexar em vez de
 * sobrescrever — por isso o limite por IP é camada extra, nunca a única defesa.
 * O valor é validado: sem isso o header virava texto arbitrário na coluna
 * device_id.
 */
export function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip');
  const xff = (req.headers.get('x-forwarded-for') ?? '').split(',')[0];
  const candidate = (cf ?? xff ?? '').trim();
  return IP_RE.test(candidate) ? candidate : 'unknown';
}

export function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Content-Type': 'application/json',
      // Resposta de API: nada de sniffing de tipo nem de cache intermediário.
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}

// ---------------------------------------------------------------------------
// Validação de entrada
//
// Tudo que chega do cliente é hostil. Os validadores abaixo usam ALLOWLISTS: um
// campo só é aceito se for exatamente do tipo e do conjunto esperados. Antes, o
// código só olhava tamanho — e `content.length` num array conta blocos, não
// caracteres, então um único bloco gigante passava pelo limite.
// ---------------------------------------------------------------------------

/** Espelham src/types.ts e src/lib/moods.ts. */
export const LANGUAGES = ['pt-BR', 'pt-PT', 'it-IT', 'en-US'] as const;
export const CALL_TYPES = ['cold_call', 'discovery', 'demo', 'negotiation'] as const;
export const FRAMEWORK_IDS = ['basic', 'SPICED', 'MEDDIC'] as const;
export const UI_LANGUAGES = ['pt', 'it', 'en'] as const;
export const MOOD_IDS = ['rushed', 'skeptical', 'curious', 'friendly_evasive', 'annoyed'] as const;
export const SPEAKERS = ['rep', 'prospect'] as const;

/** Teto do corpo da requisição, medido ANTES de parsear. Um payload legítimo fica < 60 KB. */
export const MAX_BODY_BYTES = 200_000;

export type Speaker = (typeof SPEAKERS)[number];
export interface Turn {
  speaker: Speaker;
  content: string;
}

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * device_id vem de crypto.randomUUID() no cliente. Exigir UUID fecha duas
 * portas: texto gigante gravado no banco e a colisão com o pseudo-device
 * "ip:<endereço>", que deixaria qualquer cliente consumir a cota de outro IP.
 */
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

export function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

/** String com limite de tamanho (em caracteres). */
export const str = (v: unknown, max: number, min = 0): v is string =>
  typeof v === 'string' && v.length >= min && v.length <= max;

export type Failure = { ok: false; status: number; error: string };
export const fail = (field: string, status = 400): Failure => ({
  ok: false,
  status,
  error: `invalid payload: ${field}`,
});

/**
 * Lê o corpo com teto de bytes e devolve o JSON parseado.
 *
 * Verifica o Content-Length declarado E conta o que realmente chega (um cliente
 * pode omitir ou mentir no header), cancelando a leitura ao estourar o teto.
 */
export async function readJsonBody(
  req: Request,
  max = MAX_BODY_BYTES,
): Promise<{ ok: true; value: unknown } | Failure> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) {
    return { ok: false, status: 413, error: 'payload too large' };
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (req.body) {
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        return { ok: false, status: 413, error: 'payload too large' };
      }
      chunks.push(value);
    }
  }
  const buf = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(buf)) };
  } catch {
    return { ok: false, status: 400, error: 'invalid json' };
  }
}

/**
 * Valida uma lista de falas {speaker, content}. `content` TEM de ser string: é
 * a única forma de o limite de caracteres significar o que parece.
 */
export function parseTurns(
  raw: unknown,
  field: string,
  opts: { maxItems: number; maxTotalChars: number },
): { ok: true; turns: Turn[]; chars: number } | Failure {
  if (!Array.isArray(raw)) return fail(field);
  if (raw.length > opts.maxItems) return fail(`${field} (too many)`);
  const turns: Turn[] = [];
  let chars = 0;
  for (const t of raw) {
    if (!isRecord(t) || !oneOf(SPEAKERS, t.speaker) || typeof t.content !== 'string') {
      return fail(`${field}[]`);
    }
    chars += t.content.length;
    if (chars > opts.maxTotalChars) return fail(field, 413);
    turns.push({ speaker: t.speaker, content: t.content });
  }
  return { ok: true, turns, chars };
}

/** Cliente com service role — usado só para o rate limiting (usage_events). */
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

function envInt(name: string, fallback: number): number {
  const v = Number(Deno.env.get(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/**
 * Limites de custo — os defaults são conservadores de propósito (projeto
 * pessoal, custo mínimo). Ajustáveis sem redeploy de código via secrets:
 *   supabase secrets set MAX_CALLS_PER_DAY=10
 */
export const LIMITS = {
  /** Máx. de turnos do rep por call — corta histórico infinito. */
  maxTurnsPerCall: envInt('MAX_TURNS_PER_CALL', 20),
  /** Máx. de calls (sessões de roleplay) iniciadas por device por dia. */
  maxCallsPerDay: envInt('MAX_CALLS_PER_DAY', 6),
  /** Máx. de avaliações por device por dia. */
  maxEvaluationsPerDay: envInt('MAX_EVALS_PER_DAY', 8),
};

interface Tally {
  /** Linhas deste contador hoje, INCLUINDO a reserva do request em curso. */
  requests: number;
  /** Calls distintas (session_key); linhas sem chave contam uma a uma. */
  calls: number;
  /** Quantas linhas têm o session_key deste request (1 = só a própria reserva). */
  sameSession: number;
}

export type UsageResult =
  | { ok: true }
  | { ok: false; status: 429 | 503; reason: string };

/**
 * Rate limiting por device e por IP sobre a tabela usage_events.
 *
 * DUAS travas, porque uma call são muitos requests ao LLM:
 *  - `requests/dia` é o que realmente limita o custo (todo request conta);
 *  - `calls/dia` (session_key distintos) limita quantas sessões novas começam.
 * Um session_key já visto NÃO é passe livre: só deixa de consumir uma nova
 * "call" — o request continua contando.
 *
 * RESERVA, VERIFICA, DESFAZ — e não "verifica, depois grava". O desenho antigo
 * lia o contador e só então inseria; com requisições simultâneas todas liam
 * antes de qualquer uma gravar, e 40 em paralelo passavam por um limite de 6.
 * Agora cada request primeiro GRAVA sua reserva e só depois conta (já se
 * incluindo). Propriedade: se k requisições passam, a última a gravar contou as
 * k reservas das outras (que ficam, por terem passado) e, portanto, k ≤ limite.
 * O custo é rejeitar a mais em simultaneidade exatamente no teto — a direção
 * segura; uso sequencial normal não é afetado.
 *
 * FALHA FECHADA: se o banco der erro (tabela ausente por migration não rodada,
 * banco fora, RLS), o request é recusado com 503. Antes o erro era ignorado, o
 * contador valia zero e tudo era liberado — sem limite e sem aviso.
 */
export async function checkAndLogUsage(
  deviceId: string,
  kind: 'roleplay_call' | 'evaluate',
  maxPerDay: number,
  opts: { sessionKey?: string; ip?: string; maxPerIpPerDay?: number; maxRequestsPerDay?: number } = {},
): Promise<UsageResult> {
  const db = adminClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const { sessionKey, ip } = opts;
  const maxRequests = opts.maxRequestsPerDay ?? maxPerDay * LIMITS.maxTurnsPerCall;
  const hasIp = Boolean(ip) && ip !== 'unknown';

  const unavailable: UsageResult = { ok: false, status: 503, reason: 'usage limiter unavailable' };

  // Mesmas travas por IP — derrota a rotação de device_id a partir de um host.
  // Usa um pseudo-device `ip:<addr>`; o formato UUID exigido em device_id e o
  // IP_RE de clientIp garantem que os dois espaços de chave nunca se encontram.
  const counters = [
    { key: deviceId, maxCalls: maxPerDay, maxReq: maxRequests, label: kind },
    ...(hasIp
      ? [
          {
            key: `ip:${ip}`,
            maxCalls: opts.maxPerIpPerDay ?? maxPerDay * 4,
            maxReq: maxRequests * 4,
            label: `ip/${kind}`,
          },
        ]
      : []),
  ];

  // 1. RESERVA — grava antes de contar.
  const reserved = await db
    .from('usage_events')
    .insert(counters.map((c) => ({ device_id: c.key, kind, session_key: sessionKey ?? null })))
    .select('id');
  if (reserved.error || !reserved.data) {
    console.error('usage limiter: reserve failed:', reserved.error?.message);
    return unavailable;
  }
  const ids = (reserved.data as { id: number }[]).map((r) => r.id);
  const rollback = async () => {
    const { error } = await db.from('usage_events').delete().in('id', ids);
    if (error) console.error('usage limiter: rollback failed:', error.message);
  };

  /** Uma consulta por contador: linhas = requests, session_key = calls. */
  const tally = async (key: string, cap: number): Promise<Tally | null> => {
    const { data, error } = await db
      .from('usage_events')
      .select('session_key')
      .eq('device_id', key)
      .eq('kind', kind)
      .gte('created_at', sinceIso)
      .limit(cap + 1); // basta saber que estourou; não carrega o dia inteiro
    if (error || !data) {
      console.error('usage limiter: tally failed:', error?.message);
      return null;
    }
    const rows = data as { session_key: string | null }[];
    const keys = rows
      .map((r) => r.session_key)
      .filter((k): k is string => typeof k === 'string' && k.length > 0);
    return {
      requests: rows.length,
      calls: new Set(keys).size + (rows.length - keys.length),
      sameSession: sessionKey ? keys.filter((k) => k === sessionKey).length : 0,
    };
  };

  // 2. VERIFICA — a contagem já inclui a reserva deste request.
  for (const c of counters) {
    const t = await tally(c.key, c.maxReq);
    if (!t) {
      await rollback();
      return unavailable;
    }
    if (t.requests > c.maxReq) {
      await rollback();
      return { ok: false, status: 429, reason: `daily request limit reached (${c.label})` };
    }
    // Só uma sessão NOVA consome uma call; turnos de uma call em andamento não.
    // sameSession === 1 significa que a única linha com esta chave é a reserva.
    const isNewSession = !sessionKey || t.sameSession <= 1;
    if (isNewSession && t.calls > c.maxCalls) {
      await rollback();
      return { ok: false, status: 429, reason: `daily limit reached (${c.maxCalls}/${c.label})` };
    }
  }
  return { ok: true };
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Modelos — default no Claude Haiku 4.5 ($1/M entrada, $5/M saída), o mais
 * barato da família e ótimo para falas curtas em personagem. Uma call de 10
 * turnos + avaliação custa ~US$ 0,03. Para feedback de coach mais profundo
 * (custa ~3×), troque só o avaliador:
 *   supabase secrets set ANTHROPIC_EVAL_MODEL=claude-sonnet-4-6
 */
export const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5';
export const EVAL_MODEL = Deno.env.get('ANTHROPIC_EVAL_MODEL') ?? MODEL;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Chamada mínima à Messages API da Anthropic (a key vive só aqui, como secret). */
export async function callClaude(opts: {
  system: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  model?: string;
}): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY secret not set');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model ?? MODEL,
      system: opts.system,
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // Vai para o log do Supabase. Defesa em profundidade: se um erro upstream
    // ecoar uma chave, ela não pode parar nos logs (que mais gente pode ler).
    const safe = text.slice(0, 300).replace(/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]');
    throw new Error(`Anthropic API ${res.status}: ${safe}`);
  }

  const data = await res.json();
  const block = (data.content as { type: string; text?: string }[]).find((b) => b.type === 'text');
  return block?.text ?? '';
}
