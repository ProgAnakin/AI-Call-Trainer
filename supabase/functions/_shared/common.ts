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
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (host === 'localhost' || host === '127.0.0.1') return true; // dev
  if (ALLOWED_ORIGINS.length > 0) return ALLOWED_ORIGINS.includes(origin);
  return host.endsWith('.vercel.app'); // permissive default until configured
}

/** Per-request CORS headers: reflect the origin only if it is allowed. */
export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  return {
    // A non-matching value here makes the browser block a disallowed origin.
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : 'null',
    Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

/** First hop client IP from the edge proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  return xff.split(',')[0].trim() || 'unknown';
}

export function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
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

/**
 * Rate limiting por device/dia sobre a tabela usage_events.
 * `sessionKey` deduplica: a mesma call conta uma vez só em roleplay_call.
 */
export async function checkAndLogUsage(
  deviceId: string,
  kind: 'roleplay_call' | 'evaluate',
  maxPerDay: number,
  opts: { sessionKey?: string; ip?: string; maxPerIpPerDay?: number } = {},
): Promise<{ ok: boolean; reason?: string }> {
  const db = adminClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const { sessionKey, ip } = opts;
  const maxPerIp = opts.maxPerIpPerDay ?? maxPerDay * 4;
  const hasIp = Boolean(ip) && ip !== 'unknown';

  // Dedup: the same call (session_key) counts once, even across turns.
  if (sessionKey) {
    const { count: dup } = await db
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('device_id', deviceId)
      .eq('kind', kind)
      .eq('session_key', sessionKey);
    if ((dup ?? 0) > 0) return { ok: true }; // call já contada hoje
  }

  // Per-IP cap — defeats device_id rotation from a single host. Counts a pseudo
  // "device" keyed by `ip:<addr>`, so it needs no schema change.
  if (hasIp) {
    const { count: ipCount } = await db
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('device_id', `ip:${ip}`)
      .eq('kind', kind)
      .gte('created_at', sinceIso);
    if ((ipCount ?? 0) >= maxPerIp) return { ok: false, reason: `daily limit reached (ip/${kind})` };
  }

  // Per-device cap.
  const { count } = await db
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .eq('kind', kind)
    .gte('created_at', sinceIso);
  if ((count ?? 0) >= maxPerDay) {
    return { ok: false, reason: `daily limit reached (${maxPerDay}/${kind})` };
  }

  // Log both counters (one row per call, thanks to the dedup above).
  await db.from('usage_events').insert({ device_id: deviceId, kind, session_key: sessionKey ?? null });
  if (hasIp) {
    await db
      .from('usage_events')
      .insert({ device_id: `ip:${ip}`, kind, session_key: sessionKey ?? null });
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
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const block = (data.content as { type: string; text?: string }[]).find((b) => b.type === 'text');
  return block?.text ?? '';
}
