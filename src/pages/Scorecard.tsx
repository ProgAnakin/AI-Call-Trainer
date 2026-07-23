import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { ObjectionQuality } from '@/types';
import {
  getEvaluationBySession,
  getSession,
  listTurns,
  getScenario,
} from '@/lib/storage';
import { getFramework } from '@/data/frameworks';
import { computeMetrics, formatDuration } from '@/lib/metrics';
import { ScoreReveal } from '@/components/scorecard/ScoreReveal';
import { CriterionCard } from '@/components/scorecard/CriterionCard';
import { ImprovementList } from '@/components/scorecard/ImprovementList';
import { Badge, Button, Card } from '@/components/ui';
import { useT } from '@/i18n';

type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const toneText: Record<Tone, string> = {
  good: 'text-emerald-400',
  warn: 'text-amber-400',
  bad: 'text-red-400',
  neutral: 'text-slate-200',
};

function StatTile({ value, label, hint, tone = 'neutral' }: {
  value: ReactNode;
  label: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl bg-surface px-3 py-3 text-center">
      <p className={clsx('whitespace-nowrap font-mono text-lg font-bold', toneText[tone])}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

const objectionColor: Record<ObjectionQuality, 'green' | 'amber' | 'red'> = {
  handled: 'green',
  rebutted: 'amber',
  ignored: 'red',
};

export function Scorecard() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { t } = useT();

  const session = sessionId ? getSession(sessionId) : undefined;
  const evaluation = sessionId ? getEvaluationBySession(sessionId) : undefined;

  if (!session || !evaluation) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-slate-400">
        Scorecard não encontrado.{' '}
        <button className="text-accent-soft underline" onClick={() => navigate('/')}>
          ← Home
        </button>
      </div>
    );
  }

  const scenario = getScenario(session.scenario_id);
  const turns = listTurns(session.id);
  const metrics = computeMetrics(
    turns,
    session.started_at,
    session.ended_at ?? session.started_at,
    scenario?.language ?? 'pt-BR',
  );
  const framework = getFramework(evaluation.framework);
  const talkOk = metrics.talkRatioRep <= 0.55;
  const monologueOk = metrics.longestRepMonologue <= 150;
  const fillersOk = metrics.fillerCount <= 3;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('score.title')}</h1>
        {session.outcome && (
          <Badge
            color={
              session.outcome === 'meeting_booked'
                ? 'green'
                : session.outcome === 'rejected'
                  ? 'red'
                  : 'slate'
            }
          >
            {t(`score.outcome.${session.outcome}`)}
          </Badge>
        )}
      </div>

      <div className="mb-8 flex justify-center">
        <ScoreReveal score={evaluation.overall_score} />
      </div>

      {/* Foco único para a próxima call — o acionável mais importante. */}
      {evaluation.focus_next && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mb-6 rounded-2xl border border-accent/40 bg-accent/10 p-5"
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent-soft">
            🎯 {t('score.focusNext')}
          </p>
          <p className="text-base font-medium text-slate-100">{evaluation.focus_next}</p>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">{t('score.metrics')}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <StatTile
              value={`${Math.round(metrics.talkRatioRep * 100)}%`}
              label={t('score.talkRatio')}
              hint={`rep · ${t('score.talkRatioTarget')}`}
              tone={talkOk ? 'good' : 'warn'}
            />
            <StatTile
              value={metrics.questionsAsked}
              label={t('score.questions')}
              hint={t('score.openClosed', {
                open: metrics.openQuestions,
                closed: metrics.closedQuestions,
              })}
            />
            <StatTile
              value={`${metrics.longestRepMonologue}`}
              label={t('score.monologue')}
              hint={t('score.wordsUnit')}
              tone={monologueOk ? 'good' : 'warn'}
            />
            <StatTile
              value={session.mode === 'voice' && metrics.wordsPerMinute ? metrics.wordsPerMinute : '—'}
              label={t('score.pace')}
              hint={session.mode === 'voice' ? t('score.paceUnit') : t('score.voiceOnly')}
            />
            <StatTile
              value={metrics.fillerCount}
              label={t('score.fillers')}
              tone={fillersOk ? 'good' : 'warn'}
            />
            <StatTile
              value={metrics.nextStepDetected ? '✓' : '✗'}
              label={t('score.nextStepSet')}
              tone={metrics.nextStepDetected ? 'good' : 'bad'}
            />
            <StatTile value={formatDuration(metrics.durationSeconds)} label={t('score.duration')} />
          </div>
        </Card>
      </motion.div>

      <h2 className="mb-3 text-sm font-semibold text-slate-400">
        {t('score.criteria')} · {framework.name}
      </h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {framework.criteria.map((def, i) => (
          <CriterionCard key={def.key} def={def} result={evaluation.scores[def.key]} index={i} />
        ))}
      </div>

      <ImprovementList strengths={evaluation.strengths} improvements={evaluation.improvements} />

      {/* Mapa de objeções — como o rep tratou cada objeção. */}
      {evaluation.objection_handling && evaluation.objection_handling.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">{t('score.objectionMap')}</h2>
          <ul className="space-y-3">
            {evaluation.objection_handling.map((o, i) => (
              <li key={i} className="rounded-lg bg-surface p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="text-sm italic text-slate-300">“{o.objection}”</p>
                  <Badge color={objectionColor[o.quality]} className="shrink-0">
                    {t(`score.objQuality.${o.quality}`)}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">{o.comment}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Sinais de compra perdidos. */}
      {evaluation.missed_signals && evaluation.missed_signals.length > 0 && (
        <Card className="mt-4 border-amber-900/50">
          <h2 className="mb-3 text-sm font-semibold text-amber-300">↯ {t('score.missedSignals')}</h2>
          <ul className="space-y-3">
            {evaluation.missed_signals.map((s, i) => (
              <li key={i} className="text-sm">
                <blockquote className="border-l-2 border-amber-700 pl-2 text-xs italic text-slate-400">
                  “{s.quote}”
                </blockquote>
                <p className="mt-1 text-slate-300">{s.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Abertura reescrita. */}
      {evaluation.opener_rewrite && (
        <Card className="mt-4 border-indigo-900/50">
          <h2 className="mb-2 text-sm font-semibold text-indigo-300">✎ {t('score.openerRewrite')}</h2>
          <p className="rounded-lg bg-surface px-3 py-2 text-sm text-slate-200">
            {evaluation.opener_rewrite}
          </p>
        </Card>
      )}

      {/* Melhor / pior linha. */}
      {(evaluation.best_line || evaluation.worst_line) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {evaluation.best_line && (
            <Card className="border-emerald-900/50">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                ✓ {t('score.bestLine')}
              </p>
              <p className="text-sm italic text-slate-300">“{evaluation.best_line}”</p>
            </Card>
          )}
          {evaluation.worst_line && (
            <Card className="border-red-900/50">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-300">
                ↓ {t('score.worstLine')}
              </p>
              <p className="text-sm italic text-slate-300">“{evaluation.worst_line}”</p>
            </Card>
          )}
        </div>
      )}

      {turns.length > 0 && (
        <details className="mt-6 rounded-xl border border-slate-800 bg-surface-raised">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-400 hover:text-slate-200">
            {t('score.transcript')} ({turns.length})
          </summary>
          <div className="space-y-2 border-t border-slate-800 px-4 py-3">
            {turns.map((turn) => (
              <p key={turn.id} className="text-sm leading-relaxed">
                <span
                  className={clsx(
                    'mr-2 font-mono text-[10px] font-bold uppercase',
                    turn.speaker === 'rep' ? 'text-accent-soft' : 'text-slate-500',
                  )}
                >
                  {turn.speaker === 'rep' ? t('call.you') : 'prospect'}
                </span>
                <span className="text-slate-300">{turn.content}</span>
              </p>
            ))}
          </div>
        </details>
      )}

      <div className="mt-8 flex justify-center gap-3">
        {scenario && (
          <Link to={`/call/${scenario.id}`}>
            <Button>↻ {t('score.trainAgain')}</Button>
          </Link>
        )}
        <Link to="/">
          <Button variant="secondary">{t('score.backHome')}</Button>
        </Link>
      </div>
    </div>
  );
}
