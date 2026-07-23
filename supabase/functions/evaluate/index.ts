// Edge Function /evaluate — o "cérebro avaliador" (§5.2 da spec).
// Chamado UMA vez ao final da call, com o transcript completo. Devolve o
// scorecard em JSON validado; re-pede ao modelo em caso de parse error.
import {
  callClaude,
  checkAndLogUsage,
  corsHeaders,
  EVAL_MODEL,
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
