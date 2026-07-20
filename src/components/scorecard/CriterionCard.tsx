import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { CriterionScore } from '@/types';
import type { CriterionDef } from '@/data/frameworks';
import { useT } from '@/i18n';

function barColor(score: number): string {
  if (score >= 7.5) return 'bg-emerald-500';
  if (score >= 5) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props {
  def: CriterionDef;
  result: CriterionScore | undefined;
  index: number;
}

/** Card de um critério: label, peso, barra de nota 0-10 e comentário do coach. */
export function CriterionCard({ def, result, index }: Props) {
  const { lang } = useT();
  const score = result?.score ?? 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.15 * index + 0.6 }}
      className="rounded-xl border border-slate-800 bg-surface-raised p-4"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <span className="text-sm font-semibold">{def.labels[lang]}</span>
          <span className="ml-2 text-xs text-slate-500">{def.weight}%</span>
        </div>
        <span className={clsx('font-mono text-sm font-bold', score >= 7.5 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400')}>
          {score}/10
        </span>
      </div>
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <motion.div
          className={clsx('h-full rounded-full', barColor(score))}
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ delay: 0.15 * index + 0.7, duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {result?.comment && <p className="text-xs leading-relaxed text-slate-400">{result.comment}</p>}
    </motion.div>
  );
}
