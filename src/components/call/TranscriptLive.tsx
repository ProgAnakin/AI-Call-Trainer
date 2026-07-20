import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import type { Turn } from '@/types';
import { useT } from '@/i18n';

interface Props {
  turns: Turn[];
  personaName: string;
  /** Transcrição parcial do rep enquanto fala (modo voz). */
  interim?: string;
  thinking?: boolean;
}

/** Transcript ao vivo da call, com bolhas por falante e auto-scroll. */
export function TranscriptLive({ turns, personaName, interim, thinking }: Props) {
  const { t } = useT();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, interim, thinking]);

  return (
    <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-1 py-4">
      {turns.map((turn) => (
        <motion.div
          key={turn.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={clsx('flex', turn.speaker === 'rep' ? 'justify-end' : 'justify-start')}
        >
          <div
            className={clsx(
              'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              turn.speaker === 'rep'
                ? 'rounded-br-md bg-accent text-white'
                : 'rounded-bl-md bg-surface-overlay text-slate-100',
            )}
          >
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-60">
              {turn.speaker === 'rep' ? t('call.you') : personaName}
            </p>
            {turn.content}
          </div>
        </motion.div>
      ))}

      {interim && (
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent/50 px-4 py-2.5 text-sm italic text-white/90">
            {interim}
          </div>
        </div>
      )}

      {thinking && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-md bg-surface-overlay px-4 py-3">
            <span className="inline-flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-slate-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
