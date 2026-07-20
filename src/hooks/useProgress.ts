import { useMemo } from 'react';
import type { Evaluation, Session } from '@/types';
import { listEvaluations, listSessions } from '@/lib/storage';

export interface WeeklyPoint {
  /** Segunda-feira da semana (ISO date). */
  weekStart: string;
  avgScore: number;
  sessions: number;
}

export interface ProgressData {
  sessions: Session[];
  evaluations: Evaluation[];
  totalSessions: number;
  avgOverall: number;
  streakDays: number;
  weekly: WeeklyPoint[];
  byCriterion: { key: string; avg: number }[];
}

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso);
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function dayOf(dateIso: string): string {
  return new Date(dateIso).toISOString().slice(0, 10);
}

export function computeStreak(sessionDays: string[], today = new Date()): number {
  const days = new Set(sessionDays);
  let streak = 0;
  const cursor = new Date(today);
  // streak conta a partir de hoje (ou ontem, se hoje ainda não treinou)
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useProgress(): ProgressData {
  return useMemo(() => {
    const sessions = listSessions();
    const evaluations = listEvaluations();

    const avgOverall =
      evaluations.length === 0
        ? 0
        : Math.round(evaluations.reduce((a, e) => a + e.overall_score, 0) / evaluations.length);

    const streakDays = computeStreak(sessions.map((s) => dayOf(s.started_at)));

    const byWeek = new Map<string, { total: number; n: number }>();
    for (const e of evaluations) {
      const wk = mondayOf(e.created_at);
      const agg = byWeek.get(wk) ?? { total: 0, n: 0 };
      agg.total += e.overall_score;
      agg.n += 1;
      byWeek.set(wk, agg);
    }
    const weekly: WeeklyPoint[] = [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, { total, n }]) => ({
        weekStart,
        avgScore: Math.round(total / n),
        sessions: n,
      }));

    const critAgg = new Map<string, { total: number; n: number }>();
    for (const e of evaluations) {
      for (const [key, s] of Object.entries(e.scores)) {
        const agg = critAgg.get(key) ?? { total: 0, n: 0 };
        agg.total += s.score;
        agg.n += 1;
        critAgg.set(key, agg);
      }
    }
    const byCriterion = [...critAgg.entries()].map(([key, { total, n }]) => ({
      key,
      avg: Math.round((total / n) * 10) / 10,
    }));

    return {
      sessions,
      evaluations,
      totalSessions: sessions.length,
      avgOverall,
      streakDays,
      weekly,
      byCriterion,
    };
  }, []);
}
