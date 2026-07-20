import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  getEvaluationBySession,
  getSession,
  listTurns,
  getScenario,
} from '@/lib/storage';
import { getFramework } from '@/data/frameworks';
import { computeMetrics, formatDuration, formatTalkRatio } from '@/lib/metrics';
import { ScoreReveal } from '@/components/scorecard/ScoreReveal';
import { CriterionCard } from '@/components/scorecard/CriterionCard';
import { ImprovementList } from '@/components/scorecard/ImprovementList';
import { Badge, Button, Card } from '@/components/ui';
import { useT } from '@/i18n';
import { clsx } from 'clsx';

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
  );
  const framework = getFramework(evaluation.framework);
  const talkOk = metrics.talkRatioRep <= 0.55;

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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
      >
        <Card className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-400">{t('score.metrics')}</h2>
          <div className="grid gap-4 text-center sm:grid-cols-3">
            <div>
              {/* Métrica objetiva calculada em código — não a estimativa da IA (§6). */}
              <p
                className={clsx(
                  'whitespace-nowrap font-mono text-lg font-bold',
                  talkOk ? 'text-emerald-400' : 'text-amber-400',
                )}
              >
                {formatTalkRatio(metrics.talkRatioRep)}
              </p>
              <p className="text-xs text-slate-500">
                {t('score.talkRatio')} · {t('score.talkRatioTarget')}
              </p>
            </div>
            <div>
              <p className="font-mono text-lg font-bold text-slate-200">{metrics.questionsAsked}</p>
              <p className="text-xs text-slate-500">{t('score.questions')}</p>
            </div>
            <div>
              <p className="font-mono text-lg font-bold text-slate-200">
                {formatDuration(metrics.durationSeconds)}
              </p>
              <p className="text-xs text-slate-500">{t('score.duration')}</p>
            </div>
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

      {turns.length > 0 && (
        <motion.details
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7 }}
          className="mt-6 rounded-xl border border-slate-800 bg-surface-raised"
        >
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
        </motion.details>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="mt-8 flex justify-center gap-3"
      >
        {scenario && (
          <Link to={`/call/${scenario.id}`}>
            <Button>↻ {t('score.trainAgain')}</Button>
          </Link>
        )}
        <Link to="/">
          <Button variant="secondary">{t('score.backHome')}</Button>
        </Link>
      </motion.div>
    </div>
  );
}
