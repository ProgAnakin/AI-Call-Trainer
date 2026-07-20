import type { ObjectiveMetrics, Speaker } from '@/types';

export interface TurnLike {
  speaker: Speaker;
  content: string;
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

export function computeMetrics(
  turns: TurnLike[],
  startedAt: string | Date,
  endedAt: string | Date,
): ObjectiveMetrics {
  const ratio = talkRatio(turns);
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  return {
    talkRatioRep: ratio.rep,
    repWords: ratio.repWords,
    prospectWords: ratio.prospectWords,
    questionsAsked: countQuestions(turns),
    durationSeconds: Math.max(0, Math.round((end - start) / 1000)),
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
