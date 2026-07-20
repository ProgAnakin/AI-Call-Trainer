// Edge Function /evaluate — o "cérebro avaliador" (§5.2 da spec).
// Chamado UMA vez ao final da call, com o transcript completo. Devolve o
// scorecard em JSON validado; re-pede ao modelo em caso de parse error.
import {
  callClaude,
  checkAndLogUsage,
  corsHeaders,
  json,
  LIMITS,
} from '../_shared/common.ts';

interface Body {
  device_id: string;
  transcript: { speaker: 'rep' | 'prospect'; content: string }[];
  call_type: string;
  framework: 'basic' | 'SPICED' | 'MEDDIC';
  language: string;
  success_criteria: string;
}

const CRITERIA: Record<Body['framework'], string[]> = {
  basic: [
    'abertura',
    'descoberta',
    'escuta_ativa',
    'tratamento_objecoes',
    'clareza_valor',
    'proximo_passo',
  ],
  SPICED: ['situation', 'pain', 'impact', 'critical_event', 'decision'],
  MEDDIC: [
    'metrics',
    'economic_buyer',
    'decision_criteria',
    'decision_process',
    'identify_pain',
    'champion',
  ],
};

function buildPrompt(body: Body): string {
  const criteria = CRITERIA[body.framework] ?? CRITERIA.basic;
  const scoresShape = criteria
    .map((c) => `    "${c}": {"score": 0-10, "comment": "..."}`)
    .join(',\n');

  return `Você é um coach de vendas sênior. Avalie a performance do REP neste transcript
de ${body.call_type} usando o framework ${body.framework}.
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
  "talk_ratio_estimate": "rep 60% / prospect 40%"
}
Regras: 2-3 strengths e 2-3 improvements. Notas honestas — 10 é raro.`;
}

interface EvalResult {
  overall_score: number;
  scores: Record<string, { score: number; comment: string }>;
  strengths: { point: string; quote: string }[];
  improvements: { point: string; instead_try: string }[];
  talk_ratio_estimate?: string;
}

function parseEvaluation(raw: string, framework: Body['framework']): EvalResult {
  // Tolerante a cercas de código e texto ao redor do JSON.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in response');
  const parsed = JSON.parse(raw.slice(start, end + 1)) as EvalResult;

  const criteria = CRITERIA[framework] ?? CRITERIA.basic;
  if (typeof parsed.overall_score !== 'number' || !parsed.scores) {
    throw new Error('missing overall_score/scores');
  }
  for (const c of criteria) {
    const s = parsed.scores[c];
    if (!s || typeof s.score !== 'number') throw new Error(`missing criterion: ${c}`);
    s.score = Math.max(0, Math.min(10, Math.round(s.score)));
  }
  parsed.overall_score = Math.max(0, Math.min(100, Math.round(parsed.overall_score)));
  parsed.strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
  parsed.improvements = Array.isArray(parsed.improvements) ? parsed.improvements : [];
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

    return json(result);
  } catch (e) {
    console.error('evaluate error:', e);
    return json({ error: e instanceof Error ? e.message : 'internal error' }, 500);
  }
});
