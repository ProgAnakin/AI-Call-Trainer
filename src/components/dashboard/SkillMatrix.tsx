import { clsx } from 'clsx';
import { Card } from '@/components/ui';
import { SKILL_TARGET, skillLevel, type SkillLevel } from '@/lib/coach';
import type { CriterionAvg } from '@/hooks/useProgress';
import { useT, type TKey } from '@/i18n';

const LEVEL_BAR: Record<SkillLevel, string> = {
  novice: 'bg-red-500',
  developing: 'bg-amber-500',
  proficient: 'bg-sky-500',
  advanced: 'bg-emerald-500',
};
const LEVEL_TEXT: Record<SkillLevel, string> = {
  novice: 'text-red-300',
  developing: 'text-amber-300',
  proficient: 'text-sky-300',
  advanced: 'text-emerald-300',
};

/**
 * Matriz de competências: cada critério vira uma faixa nomeada (Novato →
 * Avançado) com barra e um marcador da meta de proficiência.
 */
export function SkillMatrix({
  items,
  label,
}: {
  items: CriterionAvg[];
  label: (key: string) => string;
}) {
  const { t } = useT();
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-400">{t('skill.title')}</h2>
        <span className="text-[11px] text-slate-500">{t('skill.target', { n: SKILL_TARGET })}</span>
      </div>
      <div className="space-y-3">
        {items.map((c) => {
          const lvl = skillLevel(c.avg);
          return (
            <div key={c.key}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-300">{label(c.key)}</span>
                <span className={clsx('shrink-0 text-[11px] font-semibold', LEVEL_TEXT[lvl])}>
                  {t(`skill.level.${lvl}` as TKey)} · <span className="font-mono">{c.avg}</span>
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={clsx('h-full rounded-full', LEVEL_BAR[lvl])}
                  style={{ width: `${Math.min(100, c.avg * 10)}%` }}
                />
                <div
                  className="absolute top-0 h-full w-px bg-slate-300/60"
                  style={{ left: `${SKILL_TARGET * 10}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
