import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { SessionMode } from '@/types';
import { getPersona, getProduct, getScenario } from '@/lib/storage';
import { useCallSession } from '@/hooks/useCallSession';
import { useSpeech } from '@/hooks/useSpeech';
import {
  Badge,
  Button,
  Card,
  DifficultyDots,
  Input,
  LANGUAGE_FLAGS,
  Label,
  Select,
} from '@/components/ui';
import { Timer } from '@/components/call/Timer';
import { Waveform } from '@/components/call/Waveform';
import { PushToTalk } from '@/components/call/PushToTalk';
import { TranscriptLive } from '@/components/call/TranscriptLive';
import { useT } from '@/i18n';

export function Call() {
  const { scenarioId } = useParams<{ scenarioId: string }>();
  const navigate = useNavigate();
  const { t } = useT();

  const scenario = scenarioId ? getScenario(scenarioId) : undefined;
  const persona = scenario ? getPersona(scenario.persona_id) : undefined;
  const product = scenario ? getProduct(scenario.product_id) : undefined;

  const call = useCallSession(scenario, persona, product);
  const speech = useSpeech(scenario?.language ?? 'pt-BR');

  const voiceStorageKey = `act.voice.${scenario?.language ?? 'pt-BR'}`;
  const [mode, setMode] = useState<SessionMode>('voice');
  const [voiceURI, setVoiceURI] = useState<string>(
    () => localStorage.getItem(voiceStorageKey) ?? '',
  );
  const [draft, setDraft] = useState('');
  const [pendingVoiceText, setPendingVoiceText] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sem suporte a voz → força modo texto (fallback automático).
  useEffect(() => {
    if (!speech.supported) setMode('text');
  }, [speech.supported]);

  // Ao terminar avaliada, vai para o scorecard.
  useEffect(() => {
    if (call.state === 'scored' && call.session) {
      navigate(`/scorecard/${call.session.id}`, { replace: true });
    }
  }, [call.state, call.session, navigate]);

  useEffect(() => {
    if (call.state === 'waiting_input') inputRef.current?.focus();
  }, [call.state]);

  if (!scenario || !persona || !product) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-slate-400">
        Cenário não encontrado.{' '}
        <button className="text-accent-soft underline" onClick={() => navigate('/')}>
          ← Home
        </button>
      </div>
    );
  }

  const pickVoice = (uri: string) => {
    setVoiceURI(uri);
    if (uri) localStorage.setItem(voiceStorageKey, uri);
    else localStorage.removeItem(voiceStorageKey);
  };

  const sendLine = async (text: string) => {
    const reply = await call.sendRepLine(text);
    if (reply === null) return;
    if (mode === 'voice') {
      await speech.speak(reply, voiceURI ? { voiceURI } : undefined);
    }
    // Modo texto: "falar" é instantâneo. Se o prospect encerrou a call,
    // é o doneSpeaking que dispara a avaliação — nunca no meio do TTS.
    call.doneSpeaking();
  };

  const handleTalkRelease = async () => {
    const text = await speech.stopListening();
    if (text.trim()) {
      // Deixa o usuário revisar/editar a transcrição antes de enviar (STT erra).
      setPendingVoiceText(text.trim());
    }
  };

  const confirmVoiceText = async () => {
    if (!pendingVoiceText) return;
    const text = pendingVoiceText;
    setPendingVoiceText(null);
    await sendLine(text);
  };

  const handleTextSubmit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await sendLine(text);
  };

  const hangup = async () => {
    speech.cancelSpeech();
    await call.hangup();
  };

  // ---------- Briefing ----------
  if (call.state === 'briefing') {
    const traits: { label: string; value: number }[] = [
      { label: t('form.skepticism'), value: persona.personality.skepticism },
      { label: t('form.patience'), value: persona.personality.patience },
      { label: t('form.talkativeness'), value: persona.personality.talkativeness },
    ];
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="mb-6 text-2xl font-bold">{t('briefing.title')}</h1>
          <Card className="space-y-5">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('briefing.persona')}
              </p>
              <p className="text-lg font-semibold">
                {persona.name} — {persona.role} {LANGUAGE_FLAGS[scenario.language]}
              </p>
              <p className="mt-1 text-sm text-slate-400">{persona.company_profile}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                <Badge color="indigo">{t(`callType.${scenario.call_type}`)}</Badge>
                <span className="flex items-center gap-2">
                  {t('home.difficulty')} <DifficultyDots level={scenario.difficulty} />
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {traits.map((trait) => (
                  <div key={trait.label} className="rounded-lg bg-surface-overlay px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      {trait.label}
                    </p>
                    <div className="mt-1 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          className={`h-1 flex-1 rounded-full ${i <= trait.value ? 'bg-accent-soft' : 'bg-slate-700'}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('briefing.product')}
              </p>
              <p className="text-sm font-medium">
                {product.name} · {product.vendor}
              </p>
              <p className="mt-1 text-sm text-slate-400">{product.one_liner}</p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('briefing.goal')}
              </p>
              <p className="text-sm text-slate-200">{scenario.success_criteria}</p>
              <p className="mt-1 text-xs text-slate-500">
                {t('briefing.timeLimit')}:{' '}
                {t('briefing.minutes', { m: Math.round(scenario.time_limit_seconds / 60) })}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('briefing.mode')}
              </p>
              {!speech.supported && (
                <p className="mb-2 rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
                  {t('briefing.voiceUnsupported')}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant={mode === 'voice' ? 'primary' : 'secondary'}
                  disabled={!speech.supported}
                  onClick={() => setMode('voice')}
                >
                  🎙️ {t('briefing.mode.voice')}
                </Button>
                <Button
                  variant={mode === 'text' ? 'primary' : 'secondary'}
                  onClick={() => setMode('text')}
                >
                  ⌨️ {t('briefing.mode.text')}
                </Button>
              </div>
              {mode === 'voice' && speech.supported && speech.voices.length > 0 && (
                <div className="mt-3">
                  <Label>{t('briefing.voicePick')}</Label>
                  <Select value={voiceURI} onChange={(e) => pickVoice(e.target.value)}>
                    <option value="">{t('briefing.voiceDefault')}</option>
                    {speech.voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <Button className="w-full py-3 text-base" onClick={() => void call.start(mode)}>
              📞 {t('briefing.startCall')}
            </Button>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ---------- Encerrada sem conversa ----------
  if (call.state === 'ended_empty') {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="mb-6 text-slate-300">{t('call.endedEmpty')}</p>
        <div className="flex justify-center gap-3">
          <Link to={`/call/${scenario.id}`} reloadDocument>
            <Button>↻ {t('score.trainAgain')}</Button>
          </Link>
          <Link to="/">
            <Button variant="secondary">{t('score.backHome')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ---------- Avaliando ----------
  if (call.state === 'ended' || call.state === 'evaluating') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-slate-300">
        <Waveform active color="bg-indigo-400" />
        <p className="text-sm">{t('call.evaluating')}</p>
      </div>
    );
  }

  if (call.state === 'error') {
    const isRateLimit = /limit/i.test(call.error ?? '');
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="mb-2 text-red-400">
          {isRateLimit ? t('call.limitReached') : t('call.error')}
        </p>
        {!isRateLimit && <p className="mb-6 text-xs text-slate-500">{call.error}</p>}
        <div className="mt-6 flex justify-center gap-3">
          {!isRateLimit && (
            <Link to={`/call/${scenario.id}`} reloadDocument>
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

  // ---------- Call ao vivo ----------
  const busy = call.state === 'processing' || call.state === 'speaking';

  return (
    <div className="mx-auto flex h-[calc(100vh-57px)] max-w-2xl flex-col px-4 py-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <p className="text-sm font-semibold">
            {persona.name} · {persona.role} {LANGUAGE_FLAGS[scenario.language]}
          </p>
          <p className="text-xs text-slate-500">
            {call.state === 'processing'
              ? t('call.processing')
              : call.state === 'speaking'
                ? t('call.speaking')
                : t(`callType.${scenario.call_type}`)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Timer secondsLeft={call.secondsLeft} />
          <Button variant="danger" onClick={() => void hangup()}>
            {t('call.hangup')}
          </Button>
        </div>
      </div>

      <Waveform
        active={call.state === 'speaking' || speech.listening}
        color={speech.listening ? 'bg-red-400' : 'bg-accent'}
      />

      <TranscriptLive
        turns={call.turns}
        personaName={persona.name}
        interim={speech.listening ? speech.interim : undefined}
        thinking={call.state === 'processing'}
      />

      <div className="border-t border-slate-800 pt-4">
        <AnimatePresence mode="wait">
          {pendingVoiceText !== null ? (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <p className="text-xs text-slate-500">{t('call.editHint')}</p>
              <div className="flex gap-2">
                <Input
                  value={pendingVoiceText}
                  onChange={(e) => setPendingVoiceText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void confirmVoiceText()}
                  autoFocus
                />
                <Button onClick={() => void confirmVoiceText()}>{t('call.send')}</Button>
              </div>
            </motion.div>
          ) : mode === 'voice' ? (
            <motion.div
              key="voice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center"
            >
              <PushToTalk
                listening={speech.listening}
                disabled={busy}
                onPress={speech.startListening}
                onRelease={() => void handleTalkRelease()}
              />
            </motion.div>
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={draft}
                disabled={busy}
                placeholder={t('call.typePlaceholder')}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleTextSubmit()}
              />
              <Button disabled={busy || !draft.trim()} onClick={() => void handleTextSubmit()}>
                {t('call.send')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
