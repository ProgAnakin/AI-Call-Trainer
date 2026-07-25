import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import type { ObjectiveMetrics, SessionMode } from '@/types';
import { formatDuration } from '@/lib/metrics';
import {
  fillerStatus,
  monologueStatus,
  paceStatus,
  talkRatioStatus,
  type MetricStatus,
} from '@/lib/thresholds';
import { useT } from '@/i18n';

const statusText: Record<MetricStatus, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
  neutral: 'text-slate-200',
};

function StatTile({
  value,
  label,
  hint,
  status = 'neutral',
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  status?: MetricStatus;
}) {
  return (
    <div className="rounded-xl bg-surface px-3 py-3 text-center">
      <p className={clsx('whitespace-nowrap font-mono text-lg font-bold', statusText[status])}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

/**
 * Objective, code-computed call metrics (never LLM estimates) — the
 * conversation-intelligence layer of the scorecard.
 */
export function MetricsGrid({ metrics, mode }: { metrics: ObjectiveMetrics; mode: SessionMode }) {
  const { t } = useT();
  const paceMeasurable = mode === 'voice' && metrics.wordsPerMinute !== null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      <StatTile
        value={`${Math.round(metrics.talkRatioRep * 100)}%`}
        label={t('score.talkRatio')}
        hint={`rep · ${t('score.talkRatioTarget')}`}
        status={talkRatioStatus(metrics.talkRatioRep)}
      />
      <StatTile
        value={metrics.questionsAsked}
        label={t('score.questions')}
        hint={t('score.openClosed', {
          open: metrics.openQuestions,
          closed: metrics.closedQuestions,
        })}
      />
      <StatTile
        value={metrics.longestRepMonologue}
        label={t('score.monologue')}
        hint={t('score.wordsUnit')}
        status={monologueStatus(metrics.longestRepMonologue)}
      />
      <StatTile
        value={paceMeasurable ? metrics.wordsPerMinute : '—'}
        label={t('score.pace')}
        hint={paceMeasurable ? t('score.paceUnit') : t('score.voiceOnly')}
        status={paceMeasurable ? paceStatus(metrics.wordsPerMinute) : 'neutral'}
      />
      <StatTile
        value={metrics.fillerCount}
        label={t('score.fillers')}
        status={fillerStatus(metrics.fillerCount)}
      />
      <StatTile
        value={metrics.nextStepDetected ? '✓' : '✗'}
        label={t('score.nextStepSet')}
        status={metrics.nextStepDetected ? 'good' : 'bad'}
      />
      <StatTile value={formatDuration(metrics.durationSeconds)} label={t('score.duration')} />
    </div>
  );
}
