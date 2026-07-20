import { clsx } from 'clsx';
import { formatDuration } from '@/lib/metrics';

/** Timer regressivo da call — fica vermelho no último minuto. */
export function Timer({ secondsLeft }: { secondsLeft: number }) {
  return (
    <div
      className={clsx(
        'rounded-full px-3 py-1 font-mono text-sm tabular-nums',
        secondsLeft <= 60 ? 'bg-red-900/60 text-red-300' : 'bg-surface-overlay text-slate-300',
      )}
    >
      {formatDuration(secondsLeft)}
    </div>
  );
}
