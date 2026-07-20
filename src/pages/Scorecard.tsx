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
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className={clsx('font-mono text-xl font-bold', talkOk ? 'text-emerald-400' : 'text-amber-400')}>
                {evaluation.talk_ratio_estimate ?? formatTalkRatio(metrics.talkRatioRep)}
              </p>
              <p className="text-xs text-slate-500">
                {t('score.talkRatio')} · {t('score.talkRatioTarget')}
              </p>
            </div>
            <div>
              <p className="font-mono text-xl font-bold text-slate-200">{metrics.questionsAsked}</p>
              <p className="text-xs text-slate-500">{t('score.questions')}</p>
            </div>
            <div>
              <p className="font-mono text-xl font-bold text-slate-200">
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
