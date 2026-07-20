import { motion } from 'framer-motion';

/**
 * Waveform decorativa animada — indica quem está "no ar".
 * active=false renderiza barras estáticas baixas.
 */
export function Waveform({ active, color = 'bg-accent' }: { active: boolean; color?: string }) {
  const bars = [0.4, 0.9, 0.6, 1, 0.5, 0.8, 0.35, 0.7, 0.55, 0.95, 0.45, 0.75];
  return (
    <div className="flex h-10 items-center justify-center gap-1" aria-hidden>
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className={`w-1 rounded-full ${color}`}
          animate={
            active
              ? { height: [`${h * 12}px`, `${h * 36}px`, `${h * 12}px`] }
              : { height: '6px' }
          }
          transition={
            active
              ? { duration: 0.7 + (i % 3) * 0.15, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.2 }
          }
        />
      ))}
    </div>
  );
}
