// Utilidades compartilhadas pelas Edge Functions (Deno runtime).
import { createClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Cliente com service role — usado só para o rate limiting (usage_events). */
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export const LIMITS = {
  /** Máx. de turnos por call — corta histórico infinito. */
  maxTurnsPerCall: 30,
  /** Máx. de calls (sessões de roleplay) iniciadas por device por dia. */
  maxCallsPerDay: 10,
  /** Máx. de avaliações por device por dia. */
  maxEvaluationsPerDay: 12,
};

/**
 * Rate limiting por device/dia sobre a tabela usage_events.
 * `sessionKey` deduplica: a mesma call conta uma vez só em roleplay_call.
 */
export async function checkAndLogUsage(
  deviceId: string,
  kind: 'roleplay_call' | 'evaluate',
  maxPerDay: number,
  sessionKey?: string,
): Promise<{ ok: boolean; reason?: string }> {
  const db = adminClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  if (sessionKey) {
    const { count: dup } = await db
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('device_id', deviceId)
      .eq('kind', kind)
      .eq('session_key', sessionKey);
    if ((dup ?? 0) > 0) return { ok: true }; // call já contada hoje
  }

  const { count } = await db
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .eq('kind', kind)
    .gte('created_at', since.toISOString());

  if ((count ?? 0) >= maxPerDay) {
    return { ok: false, reason: `daily limit reached (${maxPerDay}/${kind})` };
  }

  await db.from('usage_events').insert({ device_id: deviceId, kind, session_key: sessionKey ?? null });
  return { ok: true };
}

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const MODEL = 'claude-sonnet-4-6';

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
      model: MODEL,
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
