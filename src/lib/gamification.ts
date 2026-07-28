import type { Language } from '@/types';

/**
 * Camada de gamificação — pura e determinística, derivada só do histórico que
 * já existe (avaliações + sessões + recorde de rajada). Sem novo armazenamento,
 * sem custo: XP, níveis e conquistas são recalculados a partir dos dados.
 */

/** Uma call já "casada" com o desfecho e o cenário — a unidade de XP. */
export interface CallRecord {
  /** overall_score 0-100 da avaliação. */
  score: number;
  meetingBooked: boolean;
  language: Language;
  /** Dificuldade do cenário (1-5). */
  difficulty: number;
  /** Tratou 2+ objeções e todas como "handled". */
  objectionAllHandled: boolean;
}

export interface GamificationInput {
  calls: CallRecord[];
  streakDays: number;
  /** Melhor média de rajada (0-10) entre todos os produtos. */
  bestDrillScore: number;
}

const XP_MEETING_BONUS = 25; // fechar um próximo passo vale mais que a nota
const XP_HARD_BONUS = 10; // encarar cenário difícil (4-5) dá bônus

/** XP de uma call: a nota + bônus por meeting e por dificuldade. */
export function xpOfCall(c: CallRecord): number {
  let xp = Math.max(0, Math.round(c.score));
  if (c.meetingBooked) xp += XP_MEETING_BONUS;
  if (c.difficulty >= 4) xp += XP_HARD_BONUS;
  return xp;
}

export function totalXp(calls: CallRecord[]): number {
  return calls.reduce((sum, c) => sum + xpOfCall(c), 0);
}

export interface LevelInfo {
  level: number;
  titleKey: string;
  xp: number;
  /** XP acumulado dentro do nível atual. */
  xpIntoLevel: number;
  /** XP total necessário para subir de nível (null no nível máximo). */
  xpForNext: number | null;
  nextTitleKey: string | null;
  /** 0..1 rumo ao próximo nível. */
  progress: number;
}

/** Curva de níveis com títulos temáticos de carreira SDR. */
const LEVELS: { level: number; minXp: number; titleKey: string }[] = [
  { level: 1, minXp: 0, titleKey: 'gam.level.1' },
  { level: 2, minXp: 200, titleKey: 'gam.level.2' },
  { level: 3, minXp: 500, titleKey: 'gam.level.3' },
  { level: 4, minXp: 1000, titleKey: 'gam.level.4' },
  { level: 5, minXp: 1800, titleKey: 'gam.level.5' },
  { level: 6, minXp: 3000, titleKey: 'gam.level.6' },
  { level: 7, minXp: 4800, titleKey: 'gam.level.7' },
  { level: 8, minXp: 7500, titleKey: 'gam.level.8' },
];

export function levelFromXp(xp: number): LevelInfo {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXp) idx = i;
  }
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const span = next ? next.minXp - cur.minXp : 0;
  return {
    level: cur.level,
    titleKey: cur.titleKey,
    xp,
    xpIntoLevel: xp - cur.minXp,
    xpForNext: next ? span : null,
    nextTitleKey: next ? next.titleKey : null,
    progress: next ? Math.min(1, (xp - cur.minXp) / span) : 1,
  };
}

export interface Achievement {
  id: string;
  icon: string;
  goal: number;
  /** Progresso atual, limitado ao goal para exibição. */
  current: number;
  unlocked: boolean;
  /** 0..1. */
  progress: number;
}

/** Definições de conquistas — o `current` mede o progresso rumo ao `goal`. */
export function computeAchievements(input: GamificationInput): Achievement[] {
  const { calls, streakDays, bestDrillScore } = input;
  const meetings = calls.filter((c) => c.meetingBooked).length;
  const aces = calls.filter((c) => c.score >= 85).length;
  const objAces = calls.filter((c) => c.objectionAllHandled).length;
  const langs = new Set(calls.map((c) => c.language)).size;
  const hardMeetings = calls.filter((c) => c.meetingBooked && c.difficulty >= 4).length;

  const defs: { id: string; icon: string; goal: number; current: number }[] = [
    { id: 'first_call', icon: '📞', goal: 1, current: calls.length },
    { id: 'volume_10', icon: '💪', goal: 10, current: calls.length },
    { id: 'volume_25', icon: '🏋️', goal: 25, current: calls.length },
    { id: 'meeting_1', icon: '🎯', goal: 1, current: meetings },
    { id: 'meeting_10', icon: '📅', goal: 10, current: meetings },
    { id: 'streak_3', icon: '🔥', goal: 3, current: streakDays },
    { id: 'streak_7', icon: '⚡', goal: 7, current: streakDays },
    { id: 'ace_call', icon: '🌟', goal: 1, current: aces },
    { id: 'objection_ace', icon: '🥊', goal: 1, current: objAces },
    { id: 'polyglot', icon: '🌍', goal: 2, current: langs },
    { id: 'drill_master', icon: '🥋', goal: 8, current: Math.round(bestDrillScore) },
    { id: 'tough_closer', icon: '🦈', goal: 1, current: hardMeetings },
  ];

  return defs.map((d) => ({
    id: d.id,
    icon: d.icon,
    goal: d.goal,
    current: Math.min(d.current, d.goal),
    unlocked: d.current >= d.goal,
    progress: Math.min(1, d.goal === 0 ? 1 : d.current / d.goal),
  }));
}

export interface Gamification {
  xp: number;
  level: LevelInfo;
  achievements: Achievement[];
  unlockedCount: number;
}

export function computeGamification(input: GamificationInput): Gamification {
  const xp = totalXp(input.calls);
  const achievements = computeAchievements(input);
  return {
    xp,
    level: levelFromXp(xp),
    achievements,
    unlockedCount: achievements.filter((a) => a.unlocked).length,
  };
}
