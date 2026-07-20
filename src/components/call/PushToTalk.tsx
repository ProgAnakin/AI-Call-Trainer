import { clsx } from 'clsx';
import { useT } from '@/i18n';

interface Props {
  listening: boolean;
  disabled: boolean;
  onPress: () => void;
  onRelease: () => void;
}

/**
 * Botão push-to-talk: segure (mouse/touch/tecla espaço) para falar,
 * solte para enviar. Mais confiável que reconhecimento contínuo.
 */
export function PushToTalk({ listening, disabled, onPress, onRelease }: Props) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled}
        onMouseDown={onPress}
        onMouseUp={onRelease}
        onMouseLeave={() => listening && onRelease()}
        onTouchStart={(e) => {
          e.preventDefault();
          onPress();
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          onRelease();
        }}
        onKeyDown={(e) => {
          if (e.key === ' ' && !e.repeat) {
            e.preventDefault();
            onPress();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ') {
            e.preventDefault();
            onRelease();
          }
        }}
        className={clsx(
          'relative flex h-20 w-20 items-center justify-center rounded-full text-3xl transition-all focus:outline-none focus:ring-4 focus:ring-accent/40',
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
}
