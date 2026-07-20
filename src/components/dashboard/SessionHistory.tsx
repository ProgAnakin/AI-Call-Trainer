import { Link } from 'react-router-dom';
import type { Evaluation, Session } from '@/types';
import { getPersona, getScenario } from '@/lib/storage';
import { Badge } from '@/components/ui';
import { useT } from '@/i18n';
import { LANGUAGE_FLAGS } from '@/components/ui';

interface Props {
  sessions: Session[];
  evaluations: Evaluation[];
}

/** Lista das sessões passadas com nota, persona e link para o scorecard. */
export function SessionHistory({ sessions, evaluations }: Props) {
  const { t } = useT();
  const evalBySession = new Map(evaluations.map((e) => [e.session_id, e]));

  return (
    <ul className="divide-y divide-slate-800">
      {sessions.map((s) => {
        const scenario = getScenario(s.scenario_id);
        const persona = scenario ? getPersona(scenario.persona_id) : undefined;
        const ev = evalBySession.get(s.id);
        return (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {scenario ? LANGUAGE_FLAGS[scenario.language] : ''}{' '}
                {persona ? `${persona.name} — ${persona.role}` : s.scenario_id.slice(0, 8)}
                <span className="ml-2 text-xs text-slate-500">
                  {scenario ? t(`callType.${scenario.call_type}`) : ''}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                {new Date(s.started_at).toLocaleString()}
                {s.outcome && (
                  <Badge
                    className="ml-2"
                    color={s.outcome === 'meeting_booked' ? 'green' : s.outcome === 'rejected' ? 'red' : 'slate'}
                  >
                    {t(`score.outcome.${s.outcome}`)}
                  </Badge>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {ev && (
                <span className="font-mono text-lg font-bold text-indigo-300">{ev.overall_score}</span>
              )}
              {ev && (
                <Link to={`/scorecard/${s.id}`} className="text-xs text-accent-soft hover:underline">
                  {t('progress.viewScorecard')}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
