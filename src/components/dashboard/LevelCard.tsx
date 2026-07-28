import { Card } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import type { Gamification } from '@/lib/gamification';

/** Cartão de nível: patente atual, XP e barra de progresso rumo ao próximo nível. */
export function LevelCard({ gam }: { gam: Gamification }) {
  const { t } = useT();
  const { level } = gam;
  const toNext = level.xpForNext !== null ? level.xpForNext - level.xpIntoLevel : 0;

  return (
    <Card className="bg-gradient-to-br from-indigo-950/40 to-surface">
      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-accent/20 text-accent-soft"
          aria-hidden
        >
          <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
            {t('gam.lvl')}
          </span>
          <span className="font-mono text-2xl font-bold leading-none">{level.level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-slate-100">{t(level.titleKey as TKey)}</p>
          <p className="text-xs text-slate-400">
            {t('gam.xpTotal', { xp: gam.xp })} · {t('gam.unlocked', { n: gam.unlockedCount })}
          </p>
        </div>
      </div>

      {level.xpForNext !== null ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>{level.nextTitleKey ? t(level.nextTitleKey as TKey) : ''}</span>
            <span className="font-mono">{t('gam.xpToNext', { xp: toNext })}</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-800"
            role="progressbar"
            aria-valuenow={Math.round(level.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-indigo-400 transition-all"
              style={{ width: `${Math.max(3, level.progress * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs font-semibold text-accent-soft">{t('gam.maxLevel')}</p>
      )}
    </Card>
  );
}
