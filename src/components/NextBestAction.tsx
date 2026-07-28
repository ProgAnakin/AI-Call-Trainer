import { Link } from 'react-router-dom';
import { useProgress } from '@/hooks/useProgress';
import { actionView, nextBestAction } from '@/lib/coach';
import { FRAMEWORKS } from '@/data/frameworks';
import { Button } from '@/components/ui';
import { useT, type TKey } from '@/i18n';

/**
 * Cartão "próximo passo recomendado" no topo da Home — treino adaptativo:
 * lê o progresso e aponta a ação de maior impacto agora (primeira call,
 * rajada de objeções, foco no ponto fraco, ou fechar mais meetings).
 */
export function NextBestAction() {
  const { t, lang } = useT();
  const data = useProgress();

  const action = nextBestAction({
    totalSessions: data.totalSessions,
    weakestCriterion: data.weakestCriterion,
    meetingRate: data.meetingRate,
    outcomeCount: data.outcomeCount,
  });
  const view = actionView(action);

  const criterionLabel = (key: string): string => {
    for (const fw of Object.values(FRAMEWORKS)) {
      const c = fw.criteria.find((c) => c.key === key);
      if (c) return c.labels[lang];
    }
    return key;
  };
  const vars =
    action.kind === 'focus_criterion' ? { skill: criterionLabel(action.criterionKey) } : undefined;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          {view.icon}
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft">
            {t('coach.label')}
          </p>
          <p className="text-base font-semibold text-slate-100">{t(view.titleKey as TKey, vars)}</p>
          <p className="text-sm text-slate-400">{t(view.bodyKey as TKey, vars)}</p>
        </div>
      </div>
      <Link to={view.route} className="shrink-0">
        <Button>{t(view.ctaKey as TKey)} →</Button>
      </Link>
    </div>
  );
}
