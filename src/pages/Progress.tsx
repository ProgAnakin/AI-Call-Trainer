import { useProgress } from '@/hooks/useProgress';
import { ProgressChart } from '@/components/dashboard/ProgressChart';
import { SessionHistory } from '@/components/dashboard/SessionHistory';
import { StreakBadge } from '@/components/dashboard/StreakBadge';
import { Card } from '@/components/ui';
import { FRAMEWORKS } from '@/data/frameworks';
import { useT } from '@/i18n';
import { clsx } from 'clsx';

export function Progress() {
  const { t, lang } = useT();
  const data = useProgress();

  const criterionLabel = (key: string): string => {
    for (const fw of Object.values(FRAMEWORKS)) {
      const c = fw.criteria.find((c) => c.key === key);
      if (c) return c.labels[lang];
    }
    return key;
  };

  if (data.totalSessions === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-slate-400">
        {t('progress.empty')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('progress.title')}</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-mono text-2xl font-bold">{data.totalSessions}</p>
            <p className="text-xs text-slate-500">{t('progress.sessions')}</p>
          </div>
          <span className="text-3xl">📞</span>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-mono text-2xl font-bold text-emerald-300">
              {Math.round(data.meetingRate * 100)}%
            </p>
            <p className="text-xs text-slate-500">{t('progress.meetingRate')}</p>
          </div>
          <span className="text-3xl">📅</span>
        </Card>
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-mono text-2xl font-bold text-indigo-300">{data.avgOverall}</p>
            <p className="text-xs text-slate-500">{t('progress.avgScore')}</p>
          </div>
          <span className="text-3xl">🎯</span>
        </Card>
        <Card>
          <StreakBadge days={data.streakDays} />
        </Card>
      </div>

      {data.weakestCriterion && (
        <Card className="mb-6 border-amber-900/50 bg-amber-950/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                ↯ {t('progress.weakest')}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-100">
                {criterionLabel(data.weakestCriterion.key)}{' '}
                <span className="font-mono text-sm text-amber-400">
                  {data.weakestCriterion.avg}/10
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{t('progress.weakestHint')}</p>
            </div>
            <span className="text-3xl">🎯</span>
          </div>
        </Card>
      )}

      {data.weekly.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">{t('progress.weekly')}</h2>
          <ProgressChart data={data.weekly} />
        </Card>
      )}

      {data.byCriterion.length > 0 && (
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">{t('progress.byCriterion')}</h2>
          <div className="space-y-2">
            {data.byCriterion.map((c) => (
              <div key={c.key} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-xs text-slate-400">
                  {criterionLabel(c.key)}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={clsx(
                      'h-full rounded-full',
                      c.avg >= 7.5 ? 'bg-emerald-500' : c.avg >= 5 ? 'bg-amber-500' : 'bg-red-500',
                    )}
                    style={{ width: `${c.avg * 10}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-xs">{c.avg}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-slate-400">{t('progress.history')}</h2>
        <SessionHistory sessions={data.sessions} evaluations={data.evaluations} />
      </Card>
    </div>
  );
}
