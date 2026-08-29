// =====================================================================
//  AI Call Trainer — Edge Function "evaluate" (SINGLE-FILE / DASHBOARD)
//  AUTO-GENERATED from supabase/functions/_shared/common.ts + evaluate/index.ts
//  Do NOT edit by hand — run: node supabase/dashboard-deploy/build.mjs
//  Paste this whole file into the 'evaluate' function editor in Supabase.
// =====================================================================
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
function corsHeadersFor(req: Request): Record<string, string> {
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
function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? '';
  return xff.split(',')[0].trim() || 'unknown';
}

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** Cliente com service role — usado só para o rate limiting (usage_events). */
function adminClient() {
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
const LIMITS = {
  /** Máx. de turnos do rep por call — corta histórico infinito. */
  maxTurnsPerCall: envInt('MAX_TURNS_PER_CALL', 20),
  /** Máx. de calls (sessões de roleplay) iniciadas por device por dia. */
  maxCallsPerDay: envInt('MAX_CALLS_PER_DAY', 6),
  /** Máx. de avaliações por device por dia. */
  maxEvaluationsPerDay: envInt('MAX_EVALS_PER_DAY', 8),
};

interface Tally {
  /** LLM requests logged today for this counter key. */
  requests: number;
  /** Distinct calls (session_key) today; rows without a key count individually. */
  calls: number;
  /** Session keys already counted today — lets a running call keep its turns. */
  seen: Set<string>;
}

/**
 * Rate limiting por device/dia sobre a tabela usage_events.
 *
 * DUAS travas, porque uma call são muitos requests ao LLM:
 *  - `requests/dia` é o que realmente limita o custo (todo request conta);
 *  - `calls/dia` (session_key distintos) limita quantas sessões novas começam.
 *
 * Importante: um session_key já visto NÃO é um passe livre — ele apenas não
 * consome uma nova "call". O request continua contando. (Antes, o dedup dava
 * return antecipado e permitia requests ilimitados replicando a mesma sessão.)
 */
async function checkAndLogUsage(
  deviceId: string,
  kind: 'roleplay_call' | 'evaluate',
  maxPerDay: number,
  opts: { sessionKey?: string; ip?: string; maxPerIpPerDay?: number; maxRequestsPerDay?: number } = {},
): Promise<{ ok: boolean; reason?: string }> {
  const db = adminClient();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const { sessionKey, ip } = opts;
  const maxPerIp = opts.maxPerIpPerDay ?? maxPerDay * 4;
  const maxRequests = opts.maxRequestsPerDay ?? maxPerDay * LIMITS.maxTurnsPerCall;
  const hasIp = Boolean(ip) && ip !== 'unknown';

  /** Uma consulta por chave de contagem: linhas = requests, session_key = calls. */
  const tally = async (key: string, cap: number): Promise<Tally> => {
    const { data } = await db
      .from('usage_events')
      .select('session_key')
      .eq('device_id', key)
      .eq('kind', kind)
      .gte('created_at', sinceIso)
      .limit(cap + 1); // basta saber que estourou; não carrega o dia inteiro
    const rows = (data ?? []) as { session_key: string | null }[];
    const keys = rows
      .map((r) => r.session_key)
      .filter((k): k is string => typeof k === 'string' && k.length > 0);
    const distinct = new Set(keys);
    return { requests: rows.length, calls: distinct.size + (rows.length - keys.length), seen: distinct };
  };

  const dev = await tally(deviceId, maxRequests);
  if (dev.requests >= maxRequests) {
    return { ok: false, reason: `daily request limit reached (${kind})` };
  }
  // Só uma sessão NOVA consome uma call; turnos de uma call em andamento não.
  if (!(sessionKey && dev.seen.has(sessionKey)) && dev.calls >= maxPerDay) {
    return { ok: false, reason: `daily limit reached (${maxPerDay}/${kind})` };
  }

  // Mesmas travas por IP — derrota a rotação de device_id a partir de um host.
  // Usa um pseudo-device `ip:<addr>`, então não exige mudança de schema.
  if (hasIp) {
    const ipCap = maxRequests * 4;
    const byIp = await tally(`ip:${ip}`, ipCap);
    if (byIp.requests >= ipCap) {
      return { ok: false, reason: `daily request limit reached (ip/${kind})` };
    }
    if (!(sessionKey && byIp.seen.has(sessionKey)) && byIp.calls >= maxPerIp) {
      return { ok: false, reason: `daily limit reached (ip/${kind})` };
    }
  }

  // Todo request é registrado — é isso que faz a trava de custo valer.
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
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5';
const EVAL_MODEL = Deno.env.get('ANTHROPIC_EVAL_MODEL') ?? MODEL;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Chamada mínima à Messages API da Anthropic (a key vive só aqui, como secret). */
async function callClaude(opts: {
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

// Edge Function /evaluate — o "cérebro avaliador" (§5.2 da spec).
// Chamado UMA vez ao final da call, com o transcript completo. Devolve o
// scorecard em JSON validado; re-pede ao modelo em caso de parse error.

interface Body {
  device_id: string;
  transcript: { speaker: 'rep' | 'prospect'; content: string }[];
  call_type: string;
  framework: 'basic' | 'SPICED' | 'MEDDIC';
  /** Idioma da call — as citações do transcript estão nele. */
  language: string;
  /** Idioma da interface: em que escrever o feedback (lido, não falado). */
  ui_language?: 'pt' | 'it' | 'en';
  success_criteria: string;
}

/** Pesos por critério (%) — espelham src/data/frameworks.ts. */
const WEIGHTS: Record<Body['framework'], Record<string, number>> = {
  basic: {
    abertura: 15,
    descoberta: 25,
    escuta_ativa: 15,
    tratamento_objecoes: 20,
    clareza_valor: 10,
    proximo_passo: 15,
  },
  SPICED: { situation: 15, pain: 25, impact: 25, critical_event: 15, decision: 20 },
  MEDDIC: {
    metrics: 20,
    economic_buyer: 15,
    decision_criteria: 15,
    decision_process: 15,
    identify_pain: 20,
    champion: 15,
  },
};

/** Nome legível do idioma em que escrever o feedback. */
const FEEDBACK_LANGUAGE: Record<'pt' | 'it' | 'en', string> = {
  pt: 'português',
  it: 'italiano',
  en: 'inglês',
};

function criteriaOf(framework: Body['framework']): string[] {
  return Object.keys(WEIGHTS[framework] ?? WEIGHTS.basic);
}

/** Nota geral 0-100 recalculada aqui, determinística — não confiamos na do LLM. */
function weightedOverall(
  framework: Body['framework'],
  scores: Record<string, { score: number }>,
): number {
  const weights = WEIGHTS[framework] ?? WEIGHTS.basic;
  let total = 0;
  let weightUsed = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const s = scores[key];
    if (s && Number.isFinite(s.score)) {
      total += (s.score / 10) * weight;
      weightUsed += weight;
    }
  }
  return weightUsed === 0 ? 0 : Math.round((total / weightUsed) * 100);
}

function buildPrompt(body: Body): string {
  const weights = WEIGHTS[body.framework] ?? WEIGHTS.basic;
  const scoresShape = Object.entries(weights)
    .map(([c, w]) => `    "${c}": {"score": 0-10, "comment": "..."}  // peso ${w}%`)
    .join(',\n');

  return `Você é um coach de vendas sênior. Avalie a performance do REP neste transcript
de ${body.call_type} usando o framework ${body.framework}.
Os pesos de cada critério estão anotados no formato abaixo.
Critério de sucesso da call: ${body.success_criteria}.
Escreva TODO o feedback em ${FEEDBACK_LANGUAGE[body.ui_language ?? 'en']}, mesmo que a call
tenha sido em outro idioma. As citações literais do transcript ficam no idioma original.
Seja específico e cite o transcript.
Responda APENAS com JSON válido, sem markdown, neste formato exato:
{
  "overall_score": 0-100,
  "scores": {
${scoresShape}
  },
  "strengths": [{"point": "...", "quote": "citação literal do transcript"}],
  "improvements": [{"point": "...", "instead_try": "reformulação sugerida"}],
  "talk_ratio_estimate": "rep 60% / prospect 40%",
  "focus_next": "a única coisa mais importante para o rep focar na próxima call",
  "objection_handling": [{"objection": "objeção que o prospect levantou", "quality": "ignored|rebutted|handled", "comment": "como o rep tratou"}],
  "missed_signals": [{"quote": "fala do prospect que era um sinal de compra", "note": "o que o rep deveria ter feito"}],
  "opener_rewrite": "reescreva os primeiros 30s do rep de forma mais forte",
  "best_line": "melhor fala do rep (citação literal)",
  "worst_line": "fala mais fraca do rep (citação literal)"
}
Regras:
- 2-3 strengths e 2-3 improvements. Notas honestas — 10 é raro.
- objection_handling: uma entrada por objeção real que o prospect levantou. quality = "ignored" (rep não respondeu), "rebutted" (rebateu na hora sem explorar) ou "handled" (reconheceu → explorou → respondeu). [] se não houve objeção.
- missed_signals: 0-2 momentos em que o prospect abriu uma porta e o rep não capitalizou. [] se não houver.
- focus_next: a mudança de maior impacto para a próxima call, em uma frase.`;
}

const OBJECTION_QUALITIES = ['ignored', 'rebutted', 'handled'] as const;

interface EvalResult {
  overall_score: number;
  scores: Record<string, { score: number; comment: string }>;
  strengths: { point: string; quote: string }[];
  improvements: { point: string; instead_try: string }[];
  talk_ratio_estimate?: string;
  focus_next?: string;
  objection_handling?: { objection: string; quality: string; comment: string }[];
  missed_signals?: { quote: string; note: string }[];
  opener_rewrite?: string;
  best_line?: string;
  worst_line?: string;
}

function parseEvaluation(raw: string, framework: Body['framework']): EvalResult {
  // Tolerante a cercas de código e texto ao redor do JSON.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');
  const parsed = JSON.parse(raw.slice(start, end + 1)) as EvalResult;

  if (!parsed.scores) throw new Error('missing scores');
  for (const c of criteriaOf(framework)) {
    const s = parsed.scores[c];
    if (!s || typeof s.score !== 'number') throw new Error(`missing criterion: ${c}`);
    s.score = Math.max(0, Math.min(10, Math.round(s.score)));
  }
  // Nota geral sempre ponderada pelos pesos do framework — consistente com a UI.
  parsed.overall_score = weightedOverall(framework, parsed.scores);
  parsed.strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
  parsed.improvements = Array.isArray(parsed.improvements) ? parsed.improvements : [];
  parsed.objection_handling = Array.isArray(parsed.objection_handling)
    ? parsed.objection_handling
        .filter((o) => o && typeof o.objection === 'string')
        .map((o) => ({
          ...o,
          quality: (OBJECTION_QUALITIES as readonly string[]).includes(o.quality)
            ? o.quality
            : 'rebutted',
        }))
    : [];
  parsed.missed_signals = Array.isArray(parsed.missed_signals)
    ? parsed.missed_signals.filter((s) => s && typeof s.quote === 'string')
    : [];
  return parsed;
}

const MAX_TRANSCRIPT_CHARS = 40000;

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

  try {
    const body = (await req.json()) as Body;
    if (!body.device_id || !Array.isArray(body.transcript) || body.transcript.length === 0) {
      return json({ error: 'invalid payload' }, 400, cors);
    }

    const transcriptChars = body.transcript.reduce((n, t) => n + (t?.content?.length ?? 0), 0);
    if (transcriptChars > MAX_TRANSCRIPT_CHARS) return json({ error: 'payload too large' }, 413, cors);

    const usage = await checkAndLogUsage(body.device_id, 'evaluate', LIMITS.maxEvaluationsPerDay, {
      ip: clientIp(req),
    });
    if (!usage.ok) return json({ error: usage.reason }, 429, cors);

    const transcriptText = body.transcript
      .map((t) => `${t.speaker === 'rep' ? 'REP' : 'PROSPECT'}: ${t.content}`)
      .join('\n');

    const system = buildPrompt(body);
    const ask = () =>
      callClaude({
        model: EVAL_MODEL,
        system,
        messages: [{ role: 'user', content: `TRANSCRIPT:\n${transcriptText}` }],
        temperature: 0.2, // consistência de notas
        maxTokens: 1500,
      });

    let result: EvalResult;
    try {
      result = parseEvaluation(await ask(), body.framework);
    } catch (parseError) {
      console.warn('evaluate: first parse failed, retrying once —', parseError);
      result = parseEvaluation(await ask(), body.framework);
    }

    return json(result, 200, cors);
  } catch (e) {
    console.error('evaluate error:', e);
    return json({ error: 'internal error' }, 500, cors);
  }
});
