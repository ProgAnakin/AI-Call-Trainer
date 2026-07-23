import type { Language, ObjectiveMetrics, Speaker } from '@/types';

export interface TurnLike {
  speaker: Speaker;
  content: string;
  /** Opcional — presente nos turnos reais (habilita métricas temporais). */
  ts?: string;
}

type LangFamily = 'pt' | 'it' | 'en';

export function langFamilyOf(language: Language | LangFamily): LangFamily {
  if (language.startsWith('it')) return 'it';
  if (language.startsWith('en')) return 'en';
  return 'pt';
}

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** Proporção de palavras faladas pelo rep (0-1). Meta: ≤ 0.55 em discovery. */
export function talkRatio(turns: TurnLike[]): { rep: number; repWords: number; prospectWords: number } {
  let repWords = 0;
  let prospectWords = 0;
  for (const t of turns) {
    const words = wordCount(t.content);
    if (t.speaker === 'rep') repWords += words;
    else prospectWords += words;
  }
  const total = repWords + prospectWords;
  return {
    rep: total === 0 ? 0 : repWords / total,
    repWords,
    prospectWords,
  };
}

/** Contagem de perguntas nos turnos do rep (sequências de "?" contam como 1). */
export function countQuestions(turns: TurnLike[]): number {
  return turns
    .filter((t) => t.speaker === 'rep')
    .reduce((acc, t) => acc + (t.content.match(/\?+/g)?.length ?? 0), 0);
}

/** Maior turno único (em palavras) de um falante — proxy de monólogo. */
export function longestMonologue(turns: TurnLike[], speaker: Speaker = 'rep'): number {
  return turns
    .filter((t) => t.speaker === speaker)
    .reduce((max, t) => Math.max(max, wordCount(t.content)), 0);
}

// Palavras interrogativas "abertas" (que puxam narrativa) por família de idioma.
const OPEN_STARTERS: Record<LangFamily, string[]> = {
  pt: [
    'como', 'o que', 'oque', 'que', 'por que', 'porque', 'porquê', 'por quê', 'qual', 'quais',
    'quando', 'quem', 'onde', 'quanto', 'quanta', 'quantos', 'quantas', 'me conta', 'me fala',
    'me diga', 'me diz', 'conte', 'fale', 'descreva', 'explique',
  ],
  it: [
    'come', 'cosa', 'che cosa', 'perché', 'perche', 'quale', 'quali', 'quando', 'chi', 'dove',
    'quanto', 'quanti', 'quanta', 'quante', 'mi racconti', 'mi dica', 'mi parli', 'mi spieghi',
  ],
  en: [
    'how', 'what', "what's", 'whats', 'why', 'which', 'when', 'who', 'where', 'tell me',
    'walk me', 'describe', 'explain', 'help me understand',
  ],
};

/** Extrai as frases interrogativas (texto antes de cada "?") de um texto. */
function questionFragments(text: string): string[] {
  const out: string[] = [];
  const re = /([^.?!¿]*)\?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const frag = m[1].trim();
    if (frag) out.push(frag);
  }
  return out;
}

/**
 * Classifica as perguntas do rep em abertas vs. fechadas.
 * Aberta = começa com uma palavra interrogativa que puxa narrativa.
 */
export function classifyQuestions(
  turns: TurnLike[],
  language: Language | LangFamily = 'pt',
): { open: number; closed: number } {
  const starters = OPEN_STARTERS[langFamilyOf(language)];
  let open = 0;
  let closed = 0;
  for (const turn of turns) {
    if (turn.speaker !== 'rep') continue;
    for (const frag of questionFragments(turn.content)) {
      const norm = frag
        .toLowerCase()
        .replace(/^[\s,;:—-]+/, '')
        // ignora conjunção inicial ("e qual..." → "qual...", "and what..." → "what...")
        .replace(/^(e|então|entao|mas|aí|ai|and|but|so|ma|allora|quindi)[\s,]+/, '');
      const isOpen = starters.some((s) => norm === s || norm.startsWith(s + ' '));
      if (isOpen) open++;
      else closed++;
    }
  }
  return { open, closed };
}

/** Segundos do início da call até a 1ª pergunta do rep (precisa de timestamps). */
export function timeToFirstQuestion(
  turns: TurnLike[],
  startedAt: string | Date,
): number | null {
  const start = new Date(startedAt).getTime();
  if (!Number.isFinite(start)) return null;
  for (const t of turns) {
    if (t.speaker === 'rep' && t.content.includes('?') && t.ts) {
      const at = new Date(t.ts).getTime();
      if (Number.isFinite(at)) return Math.max(0, Math.round((at - start) / 1000));
    }
  }
  return null;
}

// Muletas de linguagem por família de idioma.
const FILLERS: Record<LangFamily, string[]> = {
  pt: ['tipo', 'né', 'ne', 'então', 'entao', 'assim', 'sabe', 'aã', 'ãã', 'aham', 'hã', 'éé', 'tá', 'ok então'],
  it: ['tipo', 'cioè', 'cioe', 'allora', 'insomma', 'ecco', 'diciamo', 'no?', 'praticamente', 'ehm'],
  en: ['um', 'uh', 'like', 'you know', 'i mean', 'basically', 'actually', 'so yeah', 'kinda', 'sort of'],
};

/** Conta muletas de linguagem nos turnos do rep (limite de palavra, sem acento-sensível). */
export function countFillers(turns: TurnLike[], language: Language | LangFamily = 'pt'): number {
  const fillers = FILLERS[langFamilyOf(language)];
  const text = turns
    .filter((t) => t.speaker === 'rep')
    .map((t) => t.content)
    .join(' ')
    .toLowerCase();
  let count = 0;
  for (const f of fillers) {
    const escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, 'gu');
    count += (text.match(re) ?? []).length;
  }
  return count;
}

// Sinais de que o rep marcou um próximo passo concreto (dia/hora).
const NEXT_STEP_PATTERNS: Record<LangFamily, RegExp> = {
  pt: /\b(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo|amanhã|amanha|depois de amanhã)\b|\bàs?\s*\d{1,2}\b|\b\d{1,2}\s?h\b|\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(da\s)?(manhã|manha|tarde|noite)\b/i,
  it: /\b(lunedì|lunedi|martedì|martedi|mercoledì|mercoledi|giovedì|giovedi|venerdì|venerdi|sabato|domenica|domani|dopodomani)\b|\balle\s*\d{1,2}\b|\b\d{1,2}\s?h\b|\b\d{1,2}:\d{2}\b/i,
  en: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b|\bat\s*\d{1,2}\b|\b\d{1,2}\s?(am|pm)\b|\b\d{1,2}:\d{2}\b/i,
};

/** Rep propôs um próximo passo com dia/hora concreto? */
export function detectNextStep(turns: TurnLike[], language: Language | LangFamily = 'pt'): boolean {
  const re = NEXT_STEP_PATTERNS[langFamilyOf(language)];
  return turns.some((t) => t.speaker === 'rep' && re.test(t.content));
}

export function computeMetrics(
  turns: TurnLike[],
  startedAt: string | Date,
  endedAt: string | Date,
  language: Language | LangFamily = 'pt',
): ObjectiveMetrics {
  const ratio = talkRatio(turns);
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const durationSeconds = Math.max(0, Math.round((end - start) / 1000));
  const questions = classifyQuestions(turns, language);
  // Ritmo só faz sentido com uma janela real (voz). Abaixo de 5s = null.
  const wordsPerMinute =
    durationSeconds >= 5 ? Math.round(ratio.repWords / (durationSeconds / 60)) : null;

  return {
    talkRatioRep: ratio.rep,
    repWords: ratio.repWords,
    prospectWords: ratio.prospectWords,
    questionsAsked: countQuestions(turns),
    durationSeconds,
    longestRepMonologue: longestMonologue(turns, 'rep'),
    wordsPerMinute,
    openQuestions: questions.open,
    closedQuestions: questions.closed,
    timeToFirstQuestionSeconds: timeToFirstQuestion(turns, startedAt),
    fillerCount: countFillers(turns, language),
    nextStepDetected: detectNextStep(turns, language),
  };
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatTalkRatio(repRatio: number): string {
  const rep = Math.round(repRatio * 100);
  return `rep ${rep}% / prospect ${100 - rep}%`;
}
