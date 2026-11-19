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
function corsHeadersFor(req: Request): Record<string, string> {
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
function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip');
  const xff = (req.headers.get('x-forwarded-for') ?? '').split(',')[0];
  const candidate = (cf ?? xff ?? '').trim();
  return IP_RE.test(candidate) ? candidate : 'unknown';
}

function json(body: unknown, status = 200, cors: Record<string, string> = {}): Response {
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
const LANGUAGES = ['pt-BR', 'pt-PT', 'it-IT', 'en-US'] as const;
const CALL_TYPES = ['cold_call', 'discovery', 'demo', 'negotiation'] as const;
const FRAMEWORK_IDS = ['basic', 'SPICED', 'MEDDIC'] as const;
const UI_LANGUAGES = ['pt', 'it', 'en'] as const;
const MOOD_IDS = ['rushed', 'skeptical', 'curious', 'friendly_evasive', 'annoyed'] as const;
const SPEAKERS = ['rep', 'prospect'] as const;

/** Teto do corpo da requisição, medido ANTES de parsear. Um payload legítimo fica < 60 KB. */
const MAX_BODY_BYTES = 200_000;

type Speaker = (typeof SPEAKERS)[number];
interface Turn {
  speaker: Speaker;
  content: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * device_id vem de crypto.randomUUID() no cliente. Exigir UUID fecha duas
 * portas: texto gigante gravado no banco e a colisão com o pseudo-device
 * "ip:<endereço>", que deixaria qualquer cliente consumir a cota de outro IP.
 */
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

/** String com limite de tamanho (em caracteres). */
const str = (v: unknown, max: number, min = 0): v is string =>
  typeof v === 'string' && v.length >= min && v.length <= max;

type Failure = { ok: false; status: number; error: string };
const fail = (field: string, status = 400): Failure => ({
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
async function readJsonBody(
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
function parseTurns(
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
  /** Linhas deste contador hoje, INCLUINDO a reserva do request em curso. */
  requests: number;
  /** Calls distintas (session_key); linhas sem chave contam uma a uma. */
  calls: number;
  /** Quantas linhas têm o session_key deste request (1 = só a própria reserva). */
  sameSession: number;
}

type UsageResult =
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
async function checkAndLogUsage(
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
    // Vai para o log do Supabase. Defesa em profundidade: se um erro upstream
    // ecoar uma chave, ela não pode parar nos logs (que mais gente pode ler).
    const safe = text.slice(0, 300).replace(/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]');
    throw new Error(`Anthropic API ${res.status}: ${safe}`);
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
  transcript: Turn[];
  call_type: (typeof CALL_TYPES)[number];
  framework: (typeof FRAMEWORK_IDS)[number];
  /** Idioma da call — as citações do transcript estão nele. */
  language: (typeof LANGUAGES)[number];
  /** Idioma da interface: em que escrever o feedback (lido, não falado). */
  ui_language: (typeof UI_LANGUAGES)[number];
  success_criteria: string;
}

const MAX_TRANSCRIPT_CHARS = 40000;
const MAX_CRITERIA_CHARS = 2000;

/**
 * Valida o corpo. Antes só a transcrição tinha teto de tamanho; call_type,
 * language, ui_language e success_criteria eram interpolados no prompt sem
 * limite nem allowlist — uma porta para inflar o custo e injetar instruções.
 */
function validateEvaluate(raw: unknown): { ok: true; value: Body } | Failure {
  if (!isRecord(raw)) return fail('body');
  if (!isUuid(raw.device_id)) return fail('device_id');
  if (!oneOf(CALL_TYPES, raw.call_type)) return fail('call_type');
  if (!oneOf(FRAMEWORK_IDS, raw.framework)) return fail('framework');
  if (!oneOf(LANGUAGES, raw.language)) return fail('language');
  // Clientes antigos em cache podem não mandar ui_language: assume inglês. Um
  // valor PRESENTE mas desconhecido é rejeitado, em vez de virar "undefined".
  if (raw.ui_language !== undefined && !oneOf(UI_LANGUAGES, raw.ui_language)) {
    return fail('ui_language');
  }
  if (!str(raw.success_criteria, MAX_CRITERIA_CHARS)) return fail('success_criteria');

  const turns = parseTurns(raw.transcript, 'transcript', {
    maxItems: 200,
    maxTotalChars: MAX_TRANSCRIPT_CHARS,
  });
  if (!turns.ok) return turns;
  if (turns.turns.length === 0) return fail('transcript');

  return {
    ok: true,
    value: {
      device_id: raw.device_id,
      transcript: turns.turns,
      call_type: raw.call_type,
      framework: raw.framework,
      language: raw.language,
      ui_language: (raw.ui_language as Body['ui_language'] | undefined) ?? 'en',
      success_criteria: raw.success_criteria,
    },
  };
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

/** Nome legível do tipo de call — antes o enum cru entrava no prompt. */
const CALL_TYPE_LABEL: Record<string, string> = {
  cold_call: 'cold call',
  discovery: 'call de descoberta',
  demo: 'demonstração',
  negotiation: 'negociação',
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
de ${CALL_TYPE_LABEL[body.call_type] ?? body.call_type} usando o framework ${body.framework}.
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

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

  try {
    // Tudo que não precisa do banco é rejeitado antes de tocar o limitador.
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return json({ error: parsed.error }, parsed.status, cors);
    const checked = validateEvaluate(parsed.value);
    if (!checked.ok) return json({ error: checked.error }, checked.status, cors);
    const body = checked.value;

    const usage = await checkAndLogUsage(body.device_id, 'evaluate', LIMITS.maxEvaluationsPerDay, {
      ip: clientIp(req),
    });
    if (!usage.ok) return json({ error: usage.reason }, usage.status, cors);

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
