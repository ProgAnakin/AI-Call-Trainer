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
import { computeMetrics, formatTalkRatio, langFamilyOf } from './metrics';
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
      focus_next: d.focus_next,
      objection_handling: d.objection_handling,
      missed_signals: d.missed_signals,
      opener_rewrite: d.opener_rewrite,
      best_line: d.best_line,
      worst_line: d.worst_line,
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

// Textos localizados do feedback demo (o feedback real vem do avaliador Claude).
const DEMO_FB = {
  pt: {
    demoComment: 'Nota demo (sem IA), derivada de métricas objetivas.',
    strengthQuestions: 'Fez perguntas em vez de só pitchar.',
    focusTalk: 'Deixe o prospect falar mais — você dominou a conversa.',
    focusQuestions: 'Faça mais perguntas abertas antes de propor a solução.',
    focusNextStep: 'Feche pedindo um próximo passo com dia e hora concretos.',
    focusPain: 'Aprofunde a dor: pergunte o impacto em dinheiro ou tempo.',
    objHandled: 'Você explorou a objeção com uma pergunta antes de responder.',
    objRebutted: 'Você rebateu na hora — tente primeiro "me conta mais sobre isso".',
    objIgnored: 'Objeção ficou sem resposta.',
    demoNote: 'Modo demo: o feedback qualitativo detalhado vem do avaliador Claude.',
  },
  it: {
    demoComment: 'Voto demo (senza IA), derivato da metriche oggettive.',
    strengthQuestions: 'Ha fatto domande invece di solo pitchare.',
    focusTalk: 'Lascia parlare di più il prospect — hai dominato la conversazione.',
    focusQuestions: 'Fai più domande aperte prima di proporre la soluzione.',
    focusNextStep: 'Chiudi chiedendo un prossimo passo con data e ora concrete.',
    focusPain: 'Approfondisci il dolore: chiedi l’impatto in denaro o tempo.',
    objHandled: 'Hai esplorato l’obiezione con una domanda prima di rispondere.',
    objRebutted: 'Hai ribattuto subito — prova prima "mi racconti di più".',
    objIgnored: 'Obiezione rimasta senza risposta.',
    demoNote: 'Modalità demo: il feedback qualitativo dettagliato viene dal valutatore Claude.',
  },
  en: {
    demoComment: 'Demo score (no AI), derived from objective metrics.',
    strengthQuestions: 'Asked questions instead of only pitching.',
    focusTalk: 'Let the prospect talk more — you dominated the conversation.',
    focusQuestions: 'Ask more open questions before proposing the solution.',
    focusNextStep: 'Close by asking for a next step with a concrete day and time.',
    focusPain: 'Dig into the pain: ask for the impact in money or time.',
    objHandled: 'You explored the objection with a question before answering.',
    objRebutted: 'You rebutted instantly — try "tell me more about that" first.',
    objIgnored: 'Objection left unanswered.',
    demoNote: 'Demo mode: the detailed qualitative feedback comes from the Claude evaluator.',
  },
} as const;

function demoEvaluator(payload: EvaluatePayload): Promise<EvaluationDraft> {
  const { transcript, framework, language } = payload;
  const fam = langFamilyOf(language);
  const fb = DEMO_FB[fam];
  const now = new Date().toISOString();
  const metrics = computeMetrics(transcript, now, now, language);
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
    scores[c.key] = { score, comment: fb.demoComment };
  }

  // Mapa de objeções (heurística demo): cada fala do prospect após a saudação é
  // tratada como objeção; a qualidade vem da fala seguinte do rep.
  const objection_handling: EvaluationDraft['objection_handling'] = [];
  for (let i = 1; i < transcript.length && objection_handling.length < 3; i++) {
    if (transcript[i].speaker !== 'prospect') continue;
    const next = transcript[i + 1];
    let quality: 'ignored' | 'rebutted' | 'handled';
    let comment: string;
    if (!next || next.speaker !== 'rep') {
      quality = 'ignored';
      comment = fb.objIgnored;
    } else if (next.content.includes('?')) {
      quality = 'handled';
      comment = fb.objHandled;
    } else {
      quality = 'rebutted';
      comment = fb.objRebutted;
    }
    objection_handling.push({ objection: transcript[i].content, quality, comment });
  }

  // Foco único para a próxima call — o primeiro problema que aparecer.
  const focus_next = !talkOk
    ? fb.focusTalk
    : metrics.openQuestions < 2
      ? fb.focusQuestions
      : !metrics.nextStepDetected
        ? fb.focusNextStep
        : fb.focusPain;

  // Melhor / pior linha derivadas das métricas.
  const firstQuestion = repTurns.find((t) => t.content.includes('?'))?.content;
  const longestTurn = repTurns.reduce(
    (max, t) => (t.content.split(/\s+/).length > max.split(/\s+/).length ? t.content : max),
    '',
  );

  const draft: EvaluationDraft = {
    overall_score: weightedOverall(framework, scores),
    scores,
    strengths: firstQuestion ? [{ point: fb.strengthQuestions, quote: firstQuestion }] : [],
    improvements: [{ point: fb.demoNote, instead_try: focus_next }],
    framework,
    talk_ratio_estimate: formatTalkRatio(metrics.talkRatioRep),
    focus_next,
    objection_handling,
    best_line: firstQuestion,
    worst_line: longestTurn && longestTurn.split(/\s+/).length >= 25 ? longestTurn : undefined,
  };
  return new Promise((resolve) => setTimeout(() => resolve(draft), 900));
}
