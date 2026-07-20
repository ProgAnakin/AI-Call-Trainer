import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { useT } from '@/i18n';

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

/** Reveal animado da nota geral: círculo de progresso + contagem crescente. */
export function ScoreReveal({ score }: { score: number }) {
  const { t } = useT();
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const durationMs = 1200;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      setDisplayed(Math.round(score * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const r = 64;
  const circumference = 2 * Math.PI * r;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
          <circle cx="80" cy="80" r={r} fill="none" strokeWidth="10" className="stroke-slate-800" />
          <motion.circle
            cx="80"
            cy="80"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className={clsx('stroke-current', scoreColor(score))}
            initial={{ strokeDasharray: circumference, strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={clsx('text-5xl font-bold tabular-nums', scoreColor(score))}>
            {displayed}
          </span>
          <span className="text-xs text-slate-500">/ 100</span>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-400">{t('score.overall')}</p>
    </motion.div>
  );
}
