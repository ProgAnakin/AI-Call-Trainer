import { useT } from '@/i18n';

/** Streak de dias consecutivos de treino. */
export function StreakBadge({ days }: { days: number }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2">
      <span className="text-3xl">{days > 0 ? '🔥' : '💤'}</span>
      <div>
        <p className="font-mono text-2xl font-bold leading-none">{days}</p>
        <p className="text-xs text-slate-500">{t('progress.days', { n: days }).replace(String(days), '').trim()}</p>
      </div>
    </div>
  );
}
