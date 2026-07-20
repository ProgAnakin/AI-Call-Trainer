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
  /** Marca que o prospect terminou de falar (modo voz, após TTS). */
  doneSpeaking: () => void;
  setStateListening: () => void;
}

/**
 * Máquina de estados da call:
 * idle → briefing → (listening|waiting_input) → processing → speaking → (loop)
 *      → ended → evaluating → scored
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

  // Timer regressivo — expira → encerra a call automaticamente.
  useEffect(() => {
    if (!session || endedRef.current) return;
    if (['ended', 'evaluating', 'scored', 'briefing', 'idle', 'error'].includes(state)) return;
    const iv = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(iv);
          void endCall('abandoned');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, state]);

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

  const endCall = useCallback(
    async (outcome: SessionOutcome) => {
      if (endedRef.current || !session || !scenario) return;
      endedRef.current = true;
      setState('ended');
      const endedAt = new Date().toISOString();
      await finishSession(session.id, endedAt, outcome);

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

        if (result.ended) {
          // Deixa a última fala aparecer/ser falada; quem chama decide quando
          // encerrar via hangup(); aqui só agenda o desfecho.
          setState('speaking');
          setTimeout(
            () => void endCall(meetingBookedRef.current ? 'meeting_booked' : 'rejected'),
            600,
          );
        } else {
          setState('speaking');
        }
        return result.reply;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
        return null;
      }
    },
    [session, scenario, persona, product, endCall],
  );

  const hangup = useCallback(async () => {
    await endCall(meetingBookedRef.current ? 'meeting_booked' : 'abandoned');
  }, [endCall]);

  const doneSpeaking = useCallback(() => {
    if (!endedRef.current) {
      setState((s) => (s === 'speaking' ? (session?.mode === 'voice' ? 'listening' : 'waiting_input') : s));
    }
  }, [session]);

  const setStateListening = useCallback(() => {
    if (!endedRef.current) setState('listening');
  }, []);

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
    setStateListening,
  };
}
