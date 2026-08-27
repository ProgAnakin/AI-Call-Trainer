import { useMemo } from 'react';
import {
  computeGamification,
  type CallRecord,
  type Gamification,
} from '@/lib/gamification';
import { getDrillBest } from '@/lib/objections';
import { getEmailBest } from '@/lib/coldEmail';
import { getScenario, listEvaluations, listProducts, listSessions } from '@/lib/storage';
import { computeStreak, localDay } from './useProgress';

/**
 * Junta avaliações + sessões + cenários + recorde de rajada e devolve o estado
 * de gamificação (XP, nível, conquistas). Tudo derivado — recomputa a cada
 * mudança de dados, sem persistência extra.
 */
export function useGamification(): Gamification {
  return useMemo(() => {
    const evaluations = listEvaluations();
    const sessions = listSessions();
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    const calls: CallRecord[] = evaluations.map((ev) => {
      const session = sessionById.get(ev.session_id);
      const scenario = session ? getScenario(session.scenario_id) : undefined;
      const oh = ev.objection_handling ?? [];
      return {
        score: ev.overall_score,
        meetingBooked: session?.outcome === 'meeting_booked',
        language: scenario?.language ?? 'pt-BR',
        difficulty: scenario?.difficulty ?? 1,
        objectionAllHandled: oh.length >= 2 && oh.every((o) => o.quality === 'handled'),
      };
    });

    const streakDays = computeStreak(sessions.map((s) => localDay(new Date(s.started_at))));
    const bestDrillScore = listProducts().reduce(
      (best, p) => Math.max(best, getDrillBest(p.id) ?? 0),
      0,
    );

    return computeGamification({ calls, streakDays, bestDrillScore, bestEmailScore: getEmailBest() ?? 0 });
  }, []);
}
