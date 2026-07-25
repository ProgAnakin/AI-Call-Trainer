/**
 * Coaching targets — the single source of truth for "what good looks like".
 *
 * These numbers drive the scorecard tiles, the demo evaluator's heuristics and
 * the objection drill. They live here (rather than inline in each component) so
 * a tweak to what counts as "good" happens in exactly one place.
 */
export const TARGETS = {
  /** Rep should speak at most this share of the words (discovery benchmark). */
  talkRatioRep: 0.55,
  /** Words in a single rep turn above which it reads as a monologue. */
  longestMonologue: 150,
  /** Filler words tolerated across a whole call before it's worth flagging. */
  fillerCount: 3,
  /** Healthy speaking pace range, in words per minute (voice mode only). */
  paceMin: 110,
  paceMax: 150,
  /** Open questions expected in a decent discovery call. */
  openQuestions: 2,
} as const;

/** Words in an objection response below which it lacks substance. */
export const DRILL_SUBSTANCE_WORDS = 8;

/** Number of objections in one gauntlet run. */
export const DRILL_LENGTH = 5;

/** Seconds to answer each objection when the drill timer is on. */
export const DRILL_TIMER_SECONDS = 45;

/** Rep turns per call, mirroring the Edge Function's default cap. */
export const MAX_REP_TURNS = 20;

export type MetricStatus = 'good' | 'warn' | 'bad' | 'neutral';

/** Is the rep talking too much? */
export function talkRatioStatus(ratio: number): MetricStatus {
  return ratio <= TARGETS.talkRatioRep ? 'good' : 'warn';
}

export function monologueStatus(words: number): MetricStatus {
  return words <= TARGETS.longestMonologue ? 'good' : 'warn';
}

export function fillerStatus(count: number): MetricStatus {
  return count <= TARGETS.fillerCount ? 'good' : 'warn';
}

/** Pace is only meaningful in voice mode; null means "not measurable". */
export function paceStatus(wpm: number | null): MetricStatus {
  if (wpm === null) return 'neutral';
  return wpm >= TARGETS.paceMin && wpm <= TARGETS.paceMax ? 'good' : 'warn';
}
