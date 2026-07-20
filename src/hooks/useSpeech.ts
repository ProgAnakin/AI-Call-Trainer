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
  /** Push-to-talk: começa a ouvir. */
  startListening: () => void;
  /** Solta o botão: para de ouvir e resolve com o texto final. */
  stopListening: () => Promise<string>;
  speak: (text: string, opts?: { voiceURI?: string }) => Promise<void>;
  cancelSpeech: () => void;
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

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || listening) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true; // transcrição em tempo real na tela
    rec.continuous = false; // um turno por vez: push-to-talk é mais confiável
    finalRef.current = '';
    setInterim('');

    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(finalRef.current + interimText);
    };
    rec.onend = () => {
      setListening(false);
      if (stopResolveRef.current) {
        stopResolveRef.current(finalRef.current.trim());
        stopResolveRef.current = null;
      }
    };
    rec.onerror = () => {
      setListening(false);
      if (stopResolveRef.current) {
        stopResolveRef.current(finalRef.current.trim());
        stopResolveRef.current = null;
      }
    };

    recRef.current = rec;
    setListening(true);
    rec.start();
  }, [lang, listening]);

  const stopListening = useCallback((): Promise<string> => {
    const rec = recRef.current;
    if (!rec) return Promise.resolve('');
    return new Promise((resolve) => {
      stopResolveRef.current = resolve;
      rec.stop();
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

  return { supported, interim, listening, speaking, voices, startListening, stopListening, speak, cancelSpeech };
}
