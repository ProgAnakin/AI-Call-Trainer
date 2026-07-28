import { forwardRef, useRef } from 'react';
import { clsx } from 'clsx';
import { useT } from '@/i18n';

interface Props {
  listening: boolean;
  disabled: boolean;
  onPress: () => void;
  onRelease: () => void;
}

/**
 * Botão push-to-talk: segure (mouse/touch/tecla espaço) para falar, solte para
 * enviar. Usa Pointer Events com pointer capture — assim o "soltar" sempre volta
 * para o botão mesmo se o cursor sair de cima dele, que era o motivo do gesto
 * falhar no desktop com mouseup.
 */
export const PushToTalk = forwardRef<HTMLButtonElement, Props>(function PushToTalk(
  { listening, disabled, onPress, onRelease },
  ref,
) {
  const { t } = useT();
  // Garante que cada "press" tenha exatamente um "release", mesmo se o navegador
  // disparar eventos de ponteiro e teclado para a mesma interação.
  const activeRef = useRef(false);

  const press = () => {
    if (disabled || activeRef.current) return;
    activeRef.current = true;
    onPress();
  };
  const release = () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    onRelease();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          press();
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.currentTarget.releasePointerCapture?.(e.pointerId);
          release();
        }}
        onPointerCancel={release}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            press();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            release();
          }
        }}
        // Rede de segurança: se o foco sair no meio do hold (ex.: popup do
        // navegador), solta em vez de ficar travado "ouvindo".
        onBlur={release}
        className={clsx(
          'relative flex h-20 w-20 touch-none select-none items-center justify-center rounded-full text-3xl transition-all focus:outline-none focus:ring-4 focus:ring-accent/40',
          listening
            ? 'scale-110 bg-red-500 shadow-xl shadow-red-500/40'
            : 'bg-accent shadow-xl shadow-accent/30 hover:bg-accent-soft',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        aria-pressed={listening}
        aria-label={listening ? t('call.listening') : t('call.holdToTalk')}
      >
        {listening && (
          <span className="absolute inset-0 rounded-full bg-red-500/60 animate-pulse-ring" aria-hidden />
        )}
        🎙️
      </button>
      <p className="text-xs text-slate-400">
        {listening ? t('call.listening') : t('call.holdToTalk')}
      </p>
    </div>
  );
});
