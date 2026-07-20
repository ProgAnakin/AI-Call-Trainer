import type {
  CallType,
  Evaluation,
  FrameworkId,
  Language,
  Persona,
  Product,
  Scenario,
  Turn,
} from '@/types';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getDeviceId, isSupabaseConfigured, supabase } from './supabase';
import { computeMetrics, formatTalkRatio } from './metrics';
import { weightedOverall, getFramework } from '@/data/frameworks';

/** Sinais que o prospect emite (removidos antes de exibir/falar). */
export const HANGUP_TOKEN = '[HANGUP]';
export const MEETING_TOKEN = '[MEETING_BOOKED]';

export interface RoleplayResult {
  reply: string;
  ended: boolean;
  meetingBooked: boolean;
}

function parseReply(raw: string): RoleplayResult {
  return {
    reply: raw.replaceAll(HANGUP_TOKEN, '').replaceAll(MEETING_TOKEN, '').trim(),
    ended: raw.includes(HANGUP_TOKEN),
    meetingBooked: raw.includes(MEETING_TOKEN),
  };
}

export interface RoleplayPayload {
  scenario: Scenario;
  persona: Persona;
  product: Product;
  history: Pick<Turn, 'speaker' | 'content'>[];
}

/**
 * Invoca uma Edge Function extraindo a mensagem de erro real do corpo da
 * resposta (ex.: "daily limit reached") em vez do genérico do supabase-js.
 */
async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('supabase not configured');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await error.context.json()) as { error?: string };
        if (payload?.error) message = payload.error;
      } catch {
        // corpo não-JSON: mantém a mensagem genérica
      }
    }
    throw new Error(`${name}: ${message}`);
  }
  return data as T;
}

/**
 * Um turno de conversa com o prospect.
 * Com Supabase: Edge Function /roleplay (que guarda a API key da Anthropic).
 * Sem Supabase: prospect simulado localmente (modo demo, sem custo).
 */
export async function roleplayTurn(payload: RoleplayPayload): Promise<RoleplayResult> {
  if (supabase) {
    const data = await invokeEdgeFunction<{ reply: string }>('roleplay', {
      ...payload,
      device_id: getDeviceId(),
    });
    return parseReply(data.reply ?? '');
  }
  return demoProspect(payload);
}

export interface EvaluatePayload {
  transcript: Pick<Turn, 'speaker' | 'content'>[];
  call_type: CallType;
  framework: FrameworkId;
  language: Language;
  success_criteria: string;
}

export type EvaluationDraft = Omit<Evaluation, 'id' | 'session_id' | 'created_at'>;

/**
 * Avaliação final do transcript.
 * Com Supabase: Edge Function /evaluate. Sem: heurística local (modo demo).
 */
export async function evaluateCall(payload: EvaluatePayload): Promise<EvaluationDraft> {
  if (supabase) {
    const d = await invokeEdgeFunction<EvaluationDraft & { overall_score?: number }>('evaluate', {
      ...payload,
      device_id: getDeviceId(),
    });
    return {
      overall_score: d.overall_score ?? weightedOverall(payload.framework, d.scores),
      scores: d.scores,
      strengths: d.strengths ?? [],
      improvements: d.improvements ?? [],
      framework: payload.framework,
      talk_ratio_estimate: d.talk_ratio_estimate,
    };
  }
  return demoEvaluator(payload);
}

export function isDemoMode(): boolean {
  return !isSupabaseConfigured;
}

// ---------------------------------------------------------------------------
// Modo demo — sem Supabase/Claude. Respostas roteirizadas para testar o fluxo
// completo de UI sem custo. A avaliação usa só as métricas objetivas.
// ---------------------------------------------------------------------------

/** Falas fixas do prospect demo, na língua do cenário. */
const DEMO_LINES = {
  pt: {
    intro: (name: string) => `${name} falando. Quem é? Estou no meio de uma coisa aqui.`,
    generic: 'Certo... e por que isso me interessa?',
    reveal: (pain: string, objection: string) =>
      `Olha... para ser honesto, ${pain}. Mas ${objection}`,
    fallbackObjection: 'não sei se é prioridade agora.',
    pressed: 'Você está tomando meu tempo. Última chance: qual é exatamente a proposta?',
    close: 'Está bem, você foi direto. Me mande um convite e a gente conversa.',
    continue: 'Hmm. Continue.',
  },
  it: {
    intro: (name: string) => `Pronto, sono ${name}. Chi parla? Sono nel bel mezzo di una cosa.`,
    generic: 'Ok... e perché dovrebbe interessarmi?',
    reveal: (pain: string, objection: string) =>
      `Guardi... a essere onesti, ${pain}. Però ${objection}`,
    fallbackObjection: 'non so se è una priorità adesso.',
    pressed: 'Mi sta facendo perdere tempo. Ultima possibilità: qual è esattamente la proposta?',
    close: "Va bene, è stato diretto. Mi mandi un invito e ne parliamo.",
    continue: 'Mmh. Continui.',
  },
  en: {
    intro: (name: string) => `This is ${name}. Who's this? I'm in the middle of something.`,
    generic: "Okay... and why should I care?",
    reveal: (pain: string, objection: string) =>
      `Look... to be honest, ${pain}. But ${objection}`,
    fallbackObjection: "I'm not sure it's a priority right now.",
    pressed: "You're wasting my time. Last chance: what exactly is the offer?",
    close: "Alright, you were direct. Send me an invite and we'll talk.",
    continue: 'Hmm. Go on.',
  },
} as const;

function demoProspect(payload: RoleplayPayload): Promise<RoleplayResult> {
  const { persona, history, scenario } = payload;
  const langFamily = scenario.language.startsWith('it')
    ? 'it'
    : scenario.language.startsWith('en')
      ? 'en'
      : 'pt';
  const L = DEMO_LINES[langFamily];
  const repTurns = history.filter((t) => t.speaker === 'rep').length;
  const lastRep = [...history].reverse().find((t) => t.speaker === 'rep')?.content ?? '';
  const objections = persona.hidden_objections;

  let reply: string;

  if (repTurns <= 1) {
    reply = L.intro(persona.name);
  } else if (repTurns === 2) {
    reply = objections[0] ?? L.generic;
  } else if (repTurns >= 6) {
    reply = `${L.close} ${MEETING_TOKEN} ${HANGUP_TOKEN}`;
  } else if (/\?\s*$/.test(lastRep.trim())) {
    const pain = persona.pain_points[(repTurns - 3) % persona.pain_points.length];
    const objection = objections[(repTurns - 1) % objections.length];
    reply = L.reveal(
      `${pain.charAt(0).toLowerCase()}${pain.slice(1)}`,
      objection ? objection.charAt(0).toLowerCase() + objection.slice(1) : L.fallbackObjection,
    );
  } else {
    reply = objections[(repTurns - 1) % objections.length] ?? L.continue;
  }

  if (scenario.difficulty >= 4 && repTurns === 4) {
    reply = L.pressed;
  }

  // Latência simulada para a UI mostrar o estado "pensando"
  return new Promise((resolve) => setTimeout(() => resolve(parseReply(reply)), 700));
}

function demoEvaluator(payload: EvaluatePayload): Promise<EvaluationDraft> {
  const { transcript, framework } = payload;
  const now = new Date().toISOString();
  const metrics = computeMetrics(transcript, now, now);
  const fw = getFramework(framework);
  const repTurns = transcript.filter((t) => t.speaker === 'rep');
  const questionRate = repTurns.length === 0 ? 0 : metrics.questionsAsked / repTurns.length;
  const talkOk = metrics.talkRatioRep <= 0.55;

  const base = Math.min(9, 3 + metrics.questionsAsked); // mais perguntas ⇒ melhor no demo
  const scores: Evaluation['scores'] = {};
  for (const c of fw.criteria) {
    let score = base;
    if (c.key === 'escuta_ativa' || c.key === 'pain' || c.key === 'identify_pain') {
      score = talkOk ? Math.min(9, base + 1) : Math.max(2, base - 2);
    }
    if (c.key === 'descoberta' || c.key === 'situation' || c.key === 'metrics') {
      score = Math.min(9, Math.round(3 + questionRate * 6));
    }
    scores[c.key] = {
      score,
      comment:
        'Avaliação demo (sem IA): nota derivada de métricas objetivas. Configure o Supabase + Claude para feedback real.',
    };
  }

  const firstQuestion = repTurns.find((t) => t.content.includes('?'))?.content;
  const draft: EvaluationDraft = {
    overall_score: weightedOverall(framework, scores),
    scores,
    strengths: firstQuestion
      ? [{ point: 'Fez perguntas em vez de só pitchar.', quote: firstQuestion }]
      : [],
    improvements: [
      {
        point: talkOk
          ? 'Continue deixando o prospect falar — seu talk ratio está saudável.'
          : 'Você falou demais. Meta: rep ≤ 55% das palavras em discovery.',
        instead_try: 'Depois de cada resposta do prospect, aprofunde com "Como assim?" ou "Me conta mais".',
      },
      {
        point: 'Modo demo ativo: o feedback qualitativo real vem do avaliador Claude.',
        instead_try: 'Configure VITE_SUPABASE_URL/ANON_KEY e faça deploy das Edge Functions.',
      },
    ],
    framework,
    talk_ratio_estimate: formatTalkRatio(metrics.talkRatioRep),
  };
  return new Promise((resolve) => setTimeout(() => resolve(draft), 900));
}
