import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';

const SEEN_KEY = 'act.onboarded';

function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // storage bloqueado: não insista com o overlay
  }
}

/**
 * One-screen intro on first visit. A first-timer used to land straight on
 * scenario cards with no idea what the app does or that a scorecard follows.
 */
export function Onboarding() {
  const { t } = useT();
  const [open, setOpen] = useState(() => !hasOnboarded());

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignora storage bloqueado
    }
    setOpen(false);
  };

  const steps = [
    { icon: '🎧', title: t('onboarding.step1Title'), body: t('onboarding.step1Body') },
    { icon: '📞', title: t('onboarding.step2Title'), body: t('onboarding.step2Body') },
    { icon: '📊', title: t('onboarding.step3Title'), body: t('onboarding.step3Body') },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-surface-raised p-6"
      >
        <h2 id="onboarding-title" className="text-xl font-bold">
          {t('onboarding.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{t('onboarding.subtitle')}</p>

        <ol className="my-5 space-y-3">
          {steps.map((s) => (
            <li key={s.title} className="flex gap-3 rounded-xl bg-surface px-3 py-3">
              <span className="text-xl" aria-hidden>
                {s.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-100">{s.title}</p>
                <p className="text-xs text-slate-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <Button className="w-full py-3" onClick={dismiss} autoFocus>
          {t('onboarding.cta')}
        </Button>
      </motion.div>
    </div>
  );
}
