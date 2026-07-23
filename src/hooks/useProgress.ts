import { useMemo } from 'react';
import type { Evaluation, Session } from '@/types';
import { listEvaluations, listSessions } from '@/lib/storage';

export interface WeeklyPoint {
  /** Segunda-feira da semana (ISO date). */
  weekStart: string;
  avgScore: number;
  sessions: number;
}

export interface CriterionAvg {
  key: string;
  avg: number;
}

export interface ProgressData {
  sessions: Session[];
  evaluations: Evaluation[];
  totalSessions: number;
  avgOverall: number;
  streakDays: number;
  weekly: WeeklyPoint[];
  byCriterion: CriterionAvg[];
  /** Fração de calls (com desfecho) que agendaram meeting — a métrica-norte do SDR. */
  meetingRate: number;
  meetingBooked: number;
  outcomeCount: number;
  /** Critério com a menor média — sugestão de foco. null se dados insuficientes. */
  weakestCriterion: CriterionAvg | null;
}

/**
 * Dia no fuso LOCAL (YYYY-MM-DD). Usar UTC aqui faria um treino às 22h
 * contar como o dia seguinte e quebrar o streak.
 */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso);
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - day);
  return localDay(d);
}

function dayOf(dateIso: string): string {
  return localDay(new Date(dateIso));
}

export function computeStreak(sessionDays: string[], today = new Date()): number {
  const days = new Set(sessionDays);
  let streak = 0;
  const cursor = new Date(today);
  // streak conta a partir de hoje (ou ontem, se hoje ainda não treinou)
  if (!days.has(localDay(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(localDay(cursor))) {
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
    const byCriterion: CriterionAvg[] = [...critAgg.entries()].map(([key, { total, n }]) => ({
      key,
      avg: Math.round((total / n) * 10) / 10,
    }));

    // Taxa de meeting agendado — só conta calls que tiveram um desfecho.
    const withOutcome = sessions.filter((s) => s.outcome);
    const meetingBooked = withOutcome.filter((s) => s.outcome === 'meeting_booked').length;
    const meetingRate = withOutcome.length === 0 ? 0 : meetingBooked / withOutcome.length;

    // Critério mais fraco (com pelo menos 2 avaliações no total, para ter sinal).
    const weakestCriterion =
      evaluations.length >= 2 && byCriterion.length > 0
        ? byCriterion.reduce((min, c) => (c.avg < min.avg ? c : min))
        : null;

    return {
      sessions,
      evaluations,
      totalSessions: sessions.length,
      avgOverall,
      streakDays,
      weekly,
      byCriterion,
      meetingRate,
      meetingBooked,
      outcomeCount: withOutcome.length,
      weakestCriterion,
    };
  }, []);
}
