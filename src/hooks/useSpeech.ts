import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language } from '@/types';

// A Web Speech API ainda não está nos tipos DOM padrão — declaração mínima.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

/** Códigos de erro amigáveis (a UI traduz via i18n). */
export type SpeechError = 'blocked' | 'no-speech' | 'no-mic' | 'network' | 'failed';

function mapSpeechError(code: string): SpeechError {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'blocked';
    case 'no-speech':
      return 'no-speech';
    case 'audio-capture':
      return 'no-mic';
    case 'network':
      return 'network';
    default:
      return 'failed';
  }
}

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function isSpeechSupported(): boolean {
  return Boolean(getRecognitionCtor()) && typeof speechSynthesis !== 'undefined';
}

export interface UseSpeech {
  supported: boolean;
  /** Transcrição parcial em tempo real enquanto o usuário fala. */
  interim: string;
  listening: boolean;
  speaking: boolean;
  voices: SpeechSynthesisVoice[];
  /** Último erro de captura (null = ok). A UI traduz o código. */
  error: SpeechError | null;
  /** Push-to-talk: começa a ouvir. */
  startListening: () => void;
  /** Solta o botão: para de ouvir e resolve com o texto final. */
  stopListening: () => Promise<string>;
  speak: (text: string, opts?: { voiceURI?: string }) => Promise<void>;
  cancelSpeech: () => void;
  /** Limpa o erro atual (ex.: ao trocar de modo). */
  clearError: () => void;
  /**
   * Pede permissão do microfone antecipadamente (num clique do usuário), para
   * o popup do navegador não interromper o primeiro push-to-talk.
   * Resolve `true` se concedida.
   */
  warmupMic: () => Promise<boolean>;
}

/**
 * STT (SpeechRecognition, push-to-talk) + TTS (speechSynthesis) unificados.
 * Só funciona bem em Chrome/Edge — `supported=false` aciona fallback para texto.
 */
export function useSpeech(lang: Language): UseSpeech {
  const supported = isSpeechSupported();
  const [interim, setInterim] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState<SpeechError | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const stopResolveRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(speechSynthesis.getVoices().filter((v) => v.lang.startsWith(lang.slice(0, 2))));
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported, lang]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const warmupMic = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Só queríamos a permissão — libera o microfone na hora.
      stream.getTracks().forEach((tr) => tr.stop());
      setError(null);
      return true;
    } catch {
      setError('blocked');
      return false;
    }
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || listening) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true; // transcrição em tempo real na tela
    rec.continuous = false; // um turno por vez: push-to-talk é mais confiável
    finalRef.current = '';
    setInterim('');
    setError(null);

    // Só marca "ouvindo" quando o reconhecimento realmente começa — evita o
    // botão vermelho travado quando a permissão ainda está sendo pedida.
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(finalRef.current + interimText);
    };
    const finish = () => {
      setListening(false);
      if (stopResolveRef.current) {
        stopResolveRef.current(finalRef.current.trim());
        stopResolveRef.current = null;
      }
    };
    rec.onend = finish;
    rec.onerror = (e) => {
      // `aborted` é o nosso próprio abort() (desmontagem) — não é erro do usuário.
      if (e.error !== 'aborted') setError(mapSpeechError(e.error));
      finish();
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      // start() lança se um reconhecimento anterior ainda não encerrou — reseta.
      recRef.current = null;
      setListening(false);
      setError('failed');
    }
  }, [lang, listening]);

  const stopListening = useCallback((): Promise<string> => {
    const rec = recRef.current;
    if (!rec) return Promise.resolve('');
    return new Promise((resolve) => {
      stopResolveRef.current = resolve;
      try {
        rec.stop();
      } catch {
        // stop() antes do start real: resolve com o que houver e segue.
        stopResolveRef.current = null;
        setListening(false);
        resolve(finalRef.current.trim());
      }
    });
  }, []);

  const speak = useCallback(
    (text: string, opts?: { voiceURI?: string }): Promise<void> => {
      if (!supported || !text) return Promise.resolve();
      return new Promise((resolve) => {
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = lang;
        utt.rate = 1.05; // levemente rápido = mais natural
        const all = speechSynthesis.getVoices();
        const voice =
          (opts?.voiceURI && all.find((v) => v.voiceURI === opts.voiceURI)) ||
          all.find((v) => v.lang === lang) ||
          all.find((v) => v.lang.startsWith(lang.slice(0, 2)));
        if (voice) utt.voice = voice;
        utt.onend = () => {
          setSpeaking(false);
          resolve();
        };
        utt.onerror = () => {
          setSpeaking(false);
          resolve();
        };
        // Fila pendente (fala anterior interrompida) trava o speak no Chrome.
        if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
        setSpeaking(true);
        speechSynthesis.speak(utt);
      });
    },
    [supported, lang],
  );

  const cancelSpeech = useCallback(() => {
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return {
    supported,
    interim,
    listening,
    speaking,
    voices,
    error,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    clearError,
    warmupMic,
  };
}
