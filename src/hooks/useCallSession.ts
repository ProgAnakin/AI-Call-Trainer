import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CallState,
  Evaluation,
  Persona,
  Product,
  Scenario,
  Session,
  SessionMode,
  SessionOutcome,
  Turn,
} from '@/types';
import { evaluateCall, roleplayTurn } from '@/lib/api';
import {
  createSession,
  finishSession,
  saveEvaluation,
  saveTurn,
} from '@/lib/storage';

/** Trava client-side espelhando o limite default da Edge Function (20 turnos/call). */
const MAX_REP_TURNS = 20;

export interface UseCallSession {
  state: CallState;
  turns: Turn[];
  secondsLeft: number;
  session: Session | null;
  evaluation: Evaluation | null;
  error: string | null;
  /** Inicia a sessão (sai do briefing). */
  start: (mode: SessionMode) => Promise<void>;
  /** Envia uma fala do rep e obtém a resposta do prospect. */
  sendRepLine: (content: string) => Promise<string | null>;
  /** Rep desliga a chamada. */
  hangup: () => Promise<void>;
  /**
   * A UI terminou de apresentar a fala do prospect (TTS concluído no modo
   * voz; imediato no modo texto). Se o prospect encerrou a call, é AQUI que
   * a avaliação começa — nunca no meio da fala.
   */
  doneSpeaking: () => void;
}

/**
 * Máquina de estados da call:
 * idle → briefing → (listening|waiting_input) → processing → speaking → (loop)
 *      → ended → evaluating → scored   (ou ended_empty se não houve conversa)
 */
export function useCallSession(
  scenario: Scenario | undefined,
  persona: Persona | undefined,
  product: Product | undefined,
): UseCallSession {
  const [state, setState] = useState<CallState>('briefing');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(scenario?.time_limit_seconds ?? 300);
  const [error, setError] = useState<string | null>(null);

  const turnsRef = useRef<Turn[]>([]);
  const meetingBookedRef = useRef(false);
  const endedRef = useRef(false);
  /** Desfecho pendente quando o prospect encerrou e a fala ainda está no ar. */
  const pendingOutcomeRef = useRef<SessionOutcome | null>(null);

  const endCall = useCallback(
    async (outcome: SessionOutcome) => {
      if (endedRef.current || !session || !scenario) return;
      endedRef.current = true;
      pendingOutcomeRef.current = null;
      setState('ended');
      const endedAt = new Date().toISOString();
      await finishSession(session.id, endedAt, outcome);

      // Sem nenhuma fala não há o que avaliar — não desperdiça chamada de LLM.
      if (turnsRef.current.length === 0) {
        setState('ended_empty');
        return;
      }

      setState('evaluating');
      try {
        const draft = await evaluateCall({
          transcript: turnsRef.current.map(({ speaker, content }) => ({ speaker, content })),
          call_type: scenario.call_type,
          framework: 'basic',
          language: scenario.language,
          success_criteria: scenario.success_criteria,
        });
        const ev: Evaluation = {
          ...draft,
          id: crypto.randomUUID(),
          session_id: session.id,
          created_at: new Date().toISOString(),
        };
        await saveEvaluation(ev);
        setEvaluation(ev);
        setState('scored');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    },
    [session, scenario],
  );

  const hangup = useCallback(async () => {
    await endCall(meetingBookedRef.current ? 'meeting_booked' : 'abandoned');
  }, [endCall]);

  // Timer regressivo: o intervalo só decrementa; o desfecho fica num efeito
  // separado (efeito colateral dentro de state updater é frágil no StrictMode).
  useEffect(() => {
    if (!session) return;
    if (!['listening', 'processing', 'speaking', 'waiting_input'].includes(state)) return;
    const iv = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [session, state]);

  useEffect(() => {
    if (secondsLeft === 0 && session && !endedRef.current) {
      void hangup();
    }
  }, [secondsLeft, session, hangup]);

  const start = useCallback(
    async (mode: SessionMode) => {
      if (!scenario) return;
      const s: Session = {
        id: crypto.randomUUID(),
        scenario_id: scenario.id,
        started_at: new Date().toISOString(),
        ended_at: null,
        mode,
        outcome: null,
      };
      await createSession(s);
      setSession(s);
      setSecondsLeft(scenario.time_limit_seconds);
      setState(mode === 'voice' ? 'listening' : 'waiting_input');
    },
    [scenario],
  );

  const sendRepLine = useCallback(
    async (content: string): Promise<string | null> => {
      const text = content.trim();
      if (!text || !session || !scenario || !persona || !product || endedRef.current) return null;

      const repTurn: Turn = {
        id: crypto.randomUUID(),
        session_id: session.id,
        speaker: 'rep',
        content: text,
        ts: new Date().toISOString(),
      };
      turnsRef.current = [...turnsRef.current, repTurn];
      setTurns(turnsRef.current);
      void saveTurn(repTurn);

      setState('processing');
      try {
        const result = await roleplayTurn({
          scenario,
          persona,
          product,
          history: turnsRef.current.map(({ speaker, content: c }) => ({ speaker, content: c })),
        });

        // O rep desligou enquanto o prospect "pensava": descarta a resposta
        // para não criar turno fantasma nem sobrescrever o estado de avaliação.
        if (endedRef.current) return null;

        const prospectTurn: Turn = {
          id: crypto.randomUUID(),
          session_id: session.id,
          speaker: 'prospect',
          content: result.reply,
          ts: new Date().toISOString(),
        };
        turnsRef.current = [...turnsRef.current, prospectTurn];
        setTurns(turnsRef.current);
        void saveTurn(prospectTurn);

        if (result.meetingBooked) meetingBookedRef.current = true;

        const repTurnCount = turnsRef.current.filter((t) => t.speaker === 'rep').length;
        if (result.ended) {
          pendingOutcomeRef.current = meetingBookedRef.current ? 'meeting_booked' : 'rejected';
        } else if (repTurnCount >= MAX_REP_TURNS) {
          pendingOutcomeRef.current = meetingBookedRef.current ? 'meeting_booked' : 'abandoned';
        }

        setState('speaking');
        return result.reply;
      } catch (e) {
        if (endedRef.current) return null;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
        return null;
      }
    },
    [session, scenario, persona, product],
  );

  const doneSpeaking = useCallback(() => {
    if (endedRef.current) return;
    if (pendingOutcomeRef.current) {
      void endCall(pendingOutcomeRef.current);
      return;
    }
    setState((s) =>
      s === 'speaking' ? (session?.mode === 'voice' ? 'listening' : 'waiting_input') : s,
    );
  }, [session, endCall]);

  return {
    state,
    turns,
    secondsLeft,
    session,
    evaluation,
    error,
    start,
    sendRepLine,
    hangup,
    doneSpeaking,
  };
}
