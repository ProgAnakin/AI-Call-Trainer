import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { Language, ModelObjection } from '@/types';
import { listProducts } from '@/lib/storage';
import {
  buildGauntlet,
  getDrillBest,
  saveDrillBest,
  scoreObjectionResponse,
  type ObjectionEval,
} from '@/lib/objections';
import { Badge, Button, Card, Select, Textarea } from '@/components/ui';
import { useT } from '@/i18n';

type Phase = 'setup' | 'active' | 'reveal' | 'done';

interface Answer {
  objection: ModelObjection;
  response: string;
  result: ObjectionEval;
}

function scoreTone(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-red-400';
}

export function Drill() {
  const { t, lang } = useT();
  const products = useMemo(() => listProducts(), []);
  // Idioma das objeções segue o produto? Usamos a UI como aproximação.
  const objLanguage: Language = lang === 'it' ? 'it-IT' : lang === 'en' ? 'en-US' : 'pt-BR';

  const [phase, setPhase] = useState<Phase>('setup');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [gauntlet, setGauntlet] = useState<ModelObjection[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [draft, setDraft] = useState('');
  const [newRecord, setNewRecord] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const product = products.find((p) => p.id === productId);
  const best = productId ? getDrillBest(productId) : null;

  const start = () => {
    if (!product || product.common_objections.length === 0) return;
    setGauntlet(buildGauntlet(product));
    setIndex(0);
    setAnswers([]);
    setDraft('');
    setNewRecord(false);
    setPhase('active');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const respond = () => {
    const text = draft.trim();
    if (!text) return;
    const result = scoreObjectionResponse(text, objLanguage);
    setAnswers((a) => [...a, { objection: gauntlet[index], response: text, result }]);
    setPhase('reveal');
  };

  const next = () => {
    setDraft('');
    if (index + 1 >= gauntlet.length) {
      // Fecha a rajada: calcula média e grava recorde.
      const all = answers;
      const avg = all.length ? all.reduce((s, a) => s + a.result.score, 0) / all.length : 0;
      const beat = saveDrillBest(productId, Math.round(avg * 10) / 10);
      setNewRecord(beat);
      setPhase('done');
    } else {
      setIndex((i) => i + 1);
      setPhase('active');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const avg = answers.length
    ? Math.round((answers.reduce((s, a) => s + a.result.score, 0) / answers.length) * 10) / 10
    : 0;

  // ---------- Setup ----------
  if (phase === 'setup') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold">🥊 {t('drill.title')}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-400">{t('drill.subtitle')}</p>
        <Card className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-400">{t('drill.chooseProduct')}</p>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.vendor}
                </option>
              ))}
            </Select>
          </div>
          {product && product.common_objections.length === 0 ? (
            <p className="rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
              {t('drill.emptyProducts')}
            </p>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {best !== null ? t('drill.best', { n: best }) : t('drill.noBest')}
              </p>
              <Button onClick={start}>{t('drill.start')} →</Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ---------- Done ----------
  if (phase === 'done') {
    const bestAnswer = [...answers].sort((a, b) => b.result.score - a.result.score)[0];
    const worstAnswer = [...answers].sort((a, b) => a.result.score - b.result.score)[0];
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <h1 className="mb-1 text-2xl font-bold">{t('drill.doneTitle')}</h1>
          {newRecord && <Badge color="green" className="mb-4">{t('drill.newRecord')}</Badge>}
          <Card className="mb-4 flex items-center justify-between">
            <div>
              <p className={clsx('font-mono text-4xl font-bold', scoreTone(avg))}>{avg}</p>
              <p className="text-xs text-slate-500">{t('drill.avg')} · {answers.length} {t('drill.objections')}</p>
            </div>
            <span className="text-4xl">🥊</span>
          </Card>

          <div className="mb-4 space-y-2">
            {answers.map((a, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-raised px-3 py-2">
                <span className={clsx('w-8 shrink-0 font-mono text-sm font-bold', scoreTone(a.result.score))}>
                  {a.result.score}
                </span>
                <span className="truncate text-xs text-slate-400">“{a.objection.objection}”</span>
              </div>
            ))}
          </div>

          {bestAnswer && worstAnswer && bestAnswer !== worstAnswer && (
            <div className="mb-6 grid gap-3 sm:grid-cols-2">
              <Card className="border-emerald-900/50">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  ✓ {t('drill.bestAnswer')}
                </p>
                <p className="text-xs italic text-slate-400">“{bestAnswer.objection.objection}”</p>
              </Card>
              <Card className="border-red-900/50">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-300">
                  ↓ {t('drill.worstAnswer')}
                </p>
                <p className="text-xs italic text-slate-400">“{worstAnswer.objection.objection}”</p>
              </Card>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={start}>↻ {t('drill.trainAgain')}</Button>
            <Button variant="secondary" onClick={() => setPhase('setup')}>
              {t('drill.changeProduct')}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ---------- Active / Reveal ----------
  const current = gauntlet[index];
  const lastAnswer = answers[answers.length - 1];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-300">
          {t('drill.progress', { i: index + 1, n: gauntlet.length })}
        </p>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((index + (phase === 'reveal' ? 1 : 0)) / gauntlet.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Objeção do prospect */}
      <div className="mb-4 flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-surface-overlay px-4 py-3 text-slate-100">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-60">
            prospect
          </p>
          <p className="text-sm leading-relaxed">{current.objection}</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'active' ? (
          <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Textarea
              ref={textareaRef}
              rows={4}
              value={draft}
              placeholder={t('drill.placeholder')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) respond();
              }}
            />
            <div className="mt-2 flex justify-end">
              <Button disabled={!draft.trim()} onClick={respond}>
                {t('drill.respond')}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Resposta do rep */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white">
                {lastAnswer.response}
              </div>
            </div>

            {/* Nota + dicas */}
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400">{t('drill.scoreLabel')}</p>
                <span className={clsx('font-mono text-2xl font-bold', scoreTone(lastAnswer.result.score))}>
                  {lastAnswer.result.score}/10
                </span>
              </div>
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge color={lastAnswer.result.acknowledged ? 'green' : 'slate'}>
                  {lastAnswer.result.acknowledged ? '✓' : '○'} {t('drill.chip.acknowledge')}
                </Badge>
                <Badge color={lastAnswer.result.explored ? 'green' : 'slate'}>
                  {lastAnswer.result.explored ? '✓' : '○'} {t('drill.chip.explore')}
                </Badge>
                <Badge color={lastAnswer.result.substantive ? 'green' : 'slate'}>
                  {lastAnswer.result.substantive ? '✓' : '○'} {t('drill.chip.substance')}
                </Badge>
              </div>
              {lastAnswer.result.tipKeys.length > 0 && (
                <ul className="space-y-1">
                  {lastAnswer.result.tipKeys.map((k) => (
                    <li key={k} className="text-xs text-slate-400">
                      • {t(k)}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Resposta modelo */}
            <Card className="border-indigo-900/50">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-indigo-300">
                💡 {t('drill.modelAnswer')}
              </p>
              <p className="text-sm text-slate-200">{current.model_answer}</p>
            </Card>

            <div className="flex justify-end">
              <Button onClick={next}>
                {index + 1 >= gauntlet.length ? t('drill.finish') : `${t('drill.next')} →`}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 text-center">
        <Link to="/" className="text-xs text-slate-500 hover:text-slate-300">
          {t('drill.quit')}
        </Link>
      </div>
    </div>
  );
}
