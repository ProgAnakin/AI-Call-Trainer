import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import {
  analyzeEmail,
  getEmailBest,
  saveEmailBest,
  type EmailAnalysis,
} from '@/lib/coldEmail';
import { Badge, Button, Card, Input, Textarea } from '@/components/ui';
import { ScoreReveal } from '@/components/scorecard/ScoreReveal';
import { useT, type TKey } from '@/i18n';

const CHECK_LABEL: Record<string, TKey> = {
  concise: 'email.check.concise',
  subject: 'email.check.subject',
  cta: 'email.check.cta',
  youFocused: 'email.check.youFocused',
  noSpam: 'email.check.noSpam',
  noCliche: 'email.check.noCliche',
  lowExclaim: 'email.check.lowExclaim',
};

/**
 * Cold Email Lab (/email): paste a cold email, get an instant heuristic score
 * with per-dimension checks and coaching tips. Runs fully client-side — zero
 * API cost, like the objection gauntlet.
 */
export function EmailLab() {
  const { t, lang } = useT();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<EmailAnalysis | null>(null);
  const [best, setBest] = useState<number | null>(() => getEmailBest());
  const [newRecord, setNewRecord] = useState(false);

  const analyze = () => {
    const a = analyzeEmail({ subject, body, lang });
    setResult(a);
    setNewRecord(saveEmailBest(a.score));
    setBest(getEmailBest());
  };

  const reset = () => {
    setResult(null);
    setNewRecord(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">✉️ {t('email.title')}</h1>
      <p className="mb-6 mt-1 text-sm text-slate-400">{t('email.subtitle')}</p>

      <Card className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">{t('email.subjectLabel')}</p>
          <Input
            value={subject}
            placeholder={t('email.subjectPlaceholder')}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-slate-400">{t('email.bodyLabel')}</p>
          <Textarea
            rows={9}
            value={body}
            placeholder={t('email.bodyPlaceholder')}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {best !== null ? t('email.best', { n: best }) : t('email.noBest')}
          </p>
          <Button disabled={!body.trim()} onClick={analyze}>
            {t('email.analyze')} →
          </Button>
        </div>
      </Card>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 space-y-4"
        >
          {newRecord && (
            <div className="flex justify-center">
              <Badge color="green">{t('email.newRecord')}</Badge>
            </div>
          )}
          <div className="flex flex-col items-center">
            <ScoreReveal score={result.score} />
            <p className="mt-2 text-xs text-slate-500">
              {t('email.wordCount', { n: result.wordCount })}
            </p>
          </div>

          <Card>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('email.checksTitle')}
            </p>
            <div className="flex flex-wrap gap-2">
              {result.checks.map((c) => (
                <Badge key={c.key} color={c.pass ? 'green' : 'slate'}>
                  {c.pass ? '✓' : '○'} {t(CHECK_LABEL[c.key])}
                </Badge>
              ))}
            </div>
          </Card>

          <Card className="border-indigo-900/50">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-300">
              💡 {t('email.tipsTitle')}
            </p>
            <ul className="space-y-1.5">
              {result.tips.map((tip) => (
                <li key={tip} className={clsx('text-sm', 'text-slate-300')}>
                  • {t(tip as TKey)}
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex justify-center gap-3">
            <Button onClick={analyze}>↻ {t('email.reanalyze')}</Button>
            <Button variant="secondary" onClick={reset}>
              {t('email.clear')}
            </Button>
          </div>
        </motion.div>
      )}

      <div className="mt-8 text-center">
        <Link to="/" className="text-xs text-slate-500 hover:text-slate-300">
          {t('drill.quit')}
        </Link>
      </div>
    </div>
  );
}
