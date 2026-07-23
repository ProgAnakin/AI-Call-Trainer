// =====================================================================
//  AI Call Trainer — Edge Function "evaluate" (VERSÃO PARA COLAR NO PAINEL)
//  Cole TODO este arquivo no editor da função `evaluate` no painel do
//  Supabase. É a mesma lógica de supabase/functions/evaluate + _shared,
//  só que tudo num arquivo só (o painel deploya uma função por vez).
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

const LIMITS = {
  maxTurnsPerCall: envInt('MAX_TURNS_PER_CALL', 20),
  maxCallsPerDay: envInt('MAX_CALLS_PER_DAY', 6),
  maxEvaluationsPerDay: envInt('MAX_EVALS_PER_DAY', 8),
};

async function checkAndLogUsage(
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
    if ((dup ?? 0) > 0) return { ok: true };
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
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5';
const EVAL_MODEL = Deno.env.get('ANTHROPIC_EVAL_MODEL') ?? MODEL;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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

// ---------------------------------------------------------------------
//  Lógica específica do "cérebro avaliador" (§5.2 da spec)
// ---------------------------------------------------------------------

interface Body {
  device_id: string;
  transcript: { speaker: 'rep' | 'prospect'; content: string }[];
  call_type: string;
  framework: 'basic' | 'SPICED' | 'MEDDIC';
  language: string;
  success_criteria: string;
}

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

function criteriaOf(framework: Body['framework']): string[] {
  return Object.keys(WEIGHTS[framework] ?? WEIGHTS.basic);
}

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
Escreva os comentários em ${body.language}. Seja específico e cite o transcript.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const body = (await req.json()) as Body;
    if (!body.device_id || !Array.isArray(body.transcript) || body.transcript.length === 0) {
      return json({ error: 'invalid payload' }, 400);
    }

    const usage = await checkAndLogUsage(body.device_id, 'evaluate', LIMITS.maxEvaluationsPerDay);
    if (!usage.ok) return json({ error: usage.reason }, 429);

    const transcriptText = body.transcript
      .map((t) => `${t.speaker === 'rep' ? 'REP' : 'PROSPECT'}: ${t.content}`)
      .join('\n');

    const system = buildPrompt(body);
    const ask = () =>
      callClaude({
        model: EVAL_MODEL,
        system,
        messages: [{ role: 'user', content: `TRANSCRIPT:\n${transcriptText}` }],
        temperature: 0.2,
        maxTokens: 1500,
      });

    let result: EvalResult;
    try {
      result = parseEvaluation(await ask(), body.framework);
    } catch (parseError) {
      console.warn('evaluate: first parse failed, retrying once —', parseError);
      result = parseEvaluation(await ask(), body.framework);
    }

    return json(result);
  } catch (e) {
    console.error('evaluate error:', e);
    return json({ error: e instanceof Error ? e.message : 'internal error' }, 500);
  }
});
