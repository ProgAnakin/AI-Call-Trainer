import { motion } from 'framer-motion';
import type { Improvement, Strength } from '@/types';
import { useT } from '@/i18n';

/** Pontos fortes (com citação literal) e melhorias (com reformulação sugerida). */
export function ImprovementList({
  strengths,
  improvements,
}: {
  strengths: Strength[];
  improvements: Improvement[];
}) {
  const { t } = useT();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
        className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4"
      >
        <h3 className="mb-3 text-sm font-semibold text-emerald-300">✓ {t('score.strengths')}</h3>
        <ul className="space-y-3">
          {strengths.length === 0 && <li className="text-xs text-slate-500">—</li>}
          {strengths.map((s, i) => (
            <li key={i} className="text-sm">
              <p className="text-slate-200">{s.point}</p>
              {s.quote && (
                <blockquote className="mt-1 border-l-2 border-emerald-700 pl-2 text-xs italic text-slate-400">
                  “{s.quote}”
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.55 }}
        className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4"
      >
        <h3 className="mb-3 text-sm font-semibold text-amber-300">↗ {t('score.improvements')}</h3>
        <ul className="space-y-3">
          {improvements.length === 0 && <li className="text-xs text-slate-500">—</li>}
          {improvements.map((imp, i) => (
            <li key={i} className="text-sm">
              <p className="text-slate-200">{imp.point}</p>
              {imp.instead_try && (
                <p className="mt-1 rounded-lg bg-surface-overlay px-2 py-1.5 text-xs text-slate-300">
                  <span className="font-semibold text-amber-300">{t('score.insteadTry')}: </span>
                  {imp.instead_try}
                </p>
              )}
            </li>
          ))}
        </ul>
      </motion.section>
    </div>
  );
}
