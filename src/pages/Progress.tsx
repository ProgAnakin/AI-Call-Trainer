import { Link } from 'react-router-dom';
import { useProgress } from '@/hooks/useProgress';
import { useGamification } from '@/hooks/useGamification';
import { ProgressChart } from '@/components/dashboard/ProgressChart';
import { SessionHistory } from '@/components/dashboard/SessionHistory';
import { StreakBadge } from '@/components/dashboard/StreakBadge';
import { DataPanel } from '@/components/dashboard/DataPanel';
import { LevelCard } from '@/components/dashboard/LevelCard';
import { Achievements } from '@/components/dashboard/Achievements';
import { SkillMatrix } from '@/components/dashboard/SkillMatrix';
import { Button, Card } from '@/components/ui';
import { criterionLabel } from '@/data/frameworks';
import { useT } from '@/i18n';

export function Progress() {
  const { t, lang } = useT();
  const data = useProgress();
  const gam = useGamification();

  const label = (key: string) => criterionLabel(key, lang);

  // Empty state ainda oferece o import — é justamente quando se restaura backup.
  if (data.totalSessions === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="mb-10 text-center">
          <div className="mb-4 text-5xl" aria-hidden>📊</div>
          <p className="mb-1 text-lg font-semibold text-slate-200">{t('progress.empty')}</p>
          <p className="mb-6 text-sm text-slate-500">{t('progress.emptyHint')}</p>
          <Link to="/">
            <Button>{t('progress.emptyCta')} →</Button>
          </Link>
        </div>
        <DataPanel hasSessions={false} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">{t('progress.title')}</h1>

      <div className="mb-6">
        <LevelCard gam={gam} />
      </div>

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
                {label(data.weakestCriterion.key)}{' '}
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
        <div className="mb-6">
          <SkillMatrix items={data.byCriterion} label={label} />
        </div>
      )}

      <div className="mb-6">
        <Achievements items={gam.achievements} />
      </div>

      <Card className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-slate-400">{t('progress.history')}</h2>
        <SessionHistory sessions={data.sessions} evaluations={data.evaluations} />
      </Card>

      <DataPanel hasSessions />
    </div>
  );
}
