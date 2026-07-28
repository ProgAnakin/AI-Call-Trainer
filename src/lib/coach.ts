/**
 * Coach adaptativo — decide o próximo passo mais útil a partir do progresso.
 * Puro e determinístico; a UI traduz as chaves e injeta o rótulo do critério.
 */

export type CoachAction =
  | { kind: 'first_call' }
  | { kind: 'drill_objections' }
  | { kind: 'focus_criterion'; criterionKey: string; avg: number }
  | { kind: 'book_meeting' }
  | { kind: 'keep_going' };

export interface CoachInput {
  totalSessions: number;
  weakestCriterion: { key: string; avg: number } | null;
  meetingRate: number;
  /** Nº de calls com desfecho — sinal só é confiável com amostra mínima. */
  outcomeCount: number;
}

/** Critérios que representam tratamento de objeção (levam à rajada). */
const OBJECTION_KEYS = new Set(['tratamento_objecoes']);

/** Meta de proficiência por critério (0-10). */
export const SKILL_TARGET = 7.5;

export function nextBestAction(input: CoachInput): CoachAction {
  if (input.totalSessions === 0) return { kind: 'first_call' };

  const w = input.weakestCriterion;
  // Fraqueza clara (< 5) domina a recomendação.
  if (w && w.avg < 5) {
    return OBJECTION_KEYS.has(w.key)
      ? { kind: 'drill_objections' }
      : { kind: 'focus_criterion', criterionKey: w.key, avg: w.avg };
  }
  // Fundamentos ok, mas não converte: foque em fechar o próximo passo.
  if (input.outcomeCount >= 3 && input.meetingRate < 0.3) return { kind: 'book_meeting' };
  // Ainda há um ponto mais fraco relativo: refine-o.
  if (w) return { kind: 'focus_criterion', criterionKey: w.key, avg: w.avg };
  return { kind: 'keep_going' };
}

export interface ActionView {
  icon: string;
  route: string;
  titleKey: string;
  bodyKey: string;
  ctaKey: string;
}

/** Mapeia a ação para ícone, rota e chaves i18n. */
export function actionView(a: CoachAction): ActionView {
  switch (a.kind) {
    case 'first_call':
      return { icon: '🚀', route: '/', titleKey: 'coach.firstCall.t', bodyKey: 'coach.firstCall.b', ctaKey: 'coach.firstCall.c' };
    case 'drill_objections':
      return { icon: '🥊', route: '/drill', titleKey: 'coach.drill.t', bodyKey: 'coach.drill.b', ctaKey: 'coach.drill.c' };
    case 'book_meeting':
      return { icon: '📅', route: '/', titleKey: 'coach.meeting.t', bodyKey: 'coach.meeting.b', ctaKey: 'coach.meeting.c' };
    case 'focus_criterion':
      return { icon: '🎯', route: '/', titleKey: 'coach.focus.t', bodyKey: 'coach.focus.b', ctaKey: 'coach.focus.c' };
    case 'keep_going':
      return { icon: '🔥', route: '/', titleKey: 'coach.keep.t', bodyKey: 'coach.keep.b', ctaKey: 'coach.keep.c' };
  }
}

export type SkillLevel = 'novice' | 'developing' | 'proficient' | 'advanced';

/** Traduz uma média 0-10 numa faixa de competência. */
export function skillLevel(avg: number): SkillLevel {
  if (avg >= SKILL_TARGET) return 'advanced';
  if (avg >= 6) return 'proficient';
  if (avg >= 4) return 'developing';
  return 'novice';
}
