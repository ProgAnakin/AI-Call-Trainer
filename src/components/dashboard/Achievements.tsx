import { clsx } from 'clsx';
import { Card } from '@/components/ui';
import { useT, type TKey } from '@/i18n';
import type { Achievement } from '@/lib/gamification';

/** Grade de conquistas. Bloqueadas ficam dessaturadas com barra de progresso. */
export function Achievements({ items }: { items: Achievement[] }) {
  const { t } = useT();
  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold text-slate-400">{t('gam.achievements')}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((a) => (
          <div
            key={a.id}
            className={clsx(
              'rounded-lg border p-3 transition-colors',
              a.unlocked
                ? 'border-accent/40 bg-accent/10'
                : 'border-slate-800 bg-surface-raised',
            )}
            title={t(`gam.ach.${a.id}.d` as TKey)}
          >
            <div className="flex items-center gap-2">
              <span className={clsx('text-2xl', !a.unlocked && 'opacity-30 grayscale')} aria-hidden>
                {a.icon}
              </span>
              <div className="min-w-0">
                <p
                  className={clsx(
                    'truncate text-xs font-semibold',
                    a.unlocked ? 'text-slate-100' : 'text-slate-400',
                  )}
                >
                  {t(`gam.ach.${a.id}.t` as TKey)}
                </p>
                {a.unlocked ? (
                  <p className="text-[10px] font-medium text-accent-soft">✓ {t('gam.done')}</p>
                ) : (
                  <p className="font-mono text-[10px] text-slate-500">
                    {a.current}/{a.goal}
                  </p>
                )}
              </div>
            </div>
            {!a.unlocked && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-slate-600"
                  style={{ width: `${Math.max(4, a.progress * 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
