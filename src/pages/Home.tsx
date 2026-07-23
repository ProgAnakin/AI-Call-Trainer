import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { listPersonas, listProducts, listScenarios } from '@/lib/storage';
import { Badge, Button, Card, DifficultyDots, LANGUAGE_FLAGS } from '@/components/ui';
import { useT } from '@/i18n';

export function Home() {
  const { t } = useT();
  const scenarios = listScenarios();
  const personas = new Map(listPersonas().map((p) => [p.id, p]));
  const products = new Map(listProducts().map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('home.title')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('home.subtitle')}</p>
        </div>
        <Link
          to="/drill"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-surface-raised px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-accent hover:text-white"
        >
          🥊 {t('home.quickDrill')} →
        </Link>
      </div>

      {scenarios.length === 0 && <p className="text-slate-500">{t('home.empty')}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((s, i) => {
          const persona = personas.get(s.persona_id);
          const product = products.get(s.product_id);
          if (!persona || !product) return null;
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {persona.name} <span className="text-slate-400">· {persona.role}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {persona.company_profile}
                    </p>
                  </div>
                  <span className="text-xl" title={s.language}>
                    {LANGUAGE_FLAGS[s.language]}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge color="indigo">{t(`callType.${s.call_type}`)}</Badge>
                  <Badge>{product.name}</Badge>
                  <Badge>⏱ {t('briefing.minutes', { m: Math.round(s.time_limit_seconds / 60) })}</Badge>
                  {s.custom && <Badge color="green">{t('library.customTag')}</Badge>}
                </div>

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {t('home.difficulty')} <DifficultyDots level={s.difficulty} />
                  </div>
                  <Link to={`/call/${s.id}`}>
                    <Button>{t('home.start')} →</Button>
                  </Link>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
