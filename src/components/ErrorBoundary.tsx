import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { UiLanguage } from '@/types';
import * as safeStorage from '@/lib/safeStorage';

/**
 * Último recurso contra tela branca: qualquer exceção durante o render de uma
 * rota virava uma página em branco, sem mensagem e sem saída.
 *
 * De propósito autossuficiente — não usa o contexto de i18n nem os componentes
 * de UI do app. Uma tela de erro não pode depender das mesmas peças que podem
 * ter acabado de quebrar, então as traduções vivem aqui e o idioma é lido
 * direto do storage.
 */

const LS_KEY = 'act.ui_lang';

interface Copy {
  title: string;
  body: string;
  reload: string;
  home: string;
  details: string;
  reset: string;
  resetConfirm: string;
}

const COPY: Record<UiLanguage, Copy> = {
  en: {
    title: 'Something broke on this screen',
    body: 'Your practice history is stored on this device and was not lost. Reload to continue.',
    reload: 'Reload',
    home: 'Back to home',
    details: 'Technical details',
    reset: 'Still broken? Reset app data',
    resetConfirm:
      'This deletes your practice history, custom products and settings on THIS device. It cannot be undone. Continue?',
  },
  pt: {
    title: 'Algo quebrou nesta tela',
    body: 'Seu histórico de treino fica neste dispositivo e não foi perdido. Recarregue para continuar.',
    reload: 'Recarregar',
    home: 'Voltar ao início',
    details: 'Detalhes técnicos',
    reset: 'Continua quebrado? Apagar os dados do app',
    resetConfirm:
      'Isto apaga seu histórico de treino, produtos personalizados e configurações NESTE dispositivo. Não dá para desfazer. Continuar?',
  },
  it: {
    title: 'Qualcosa si è rotto in questa schermata',
    body: 'Lo storico degli allenamenti è salvato su questo dispositivo e non è stato perso. Ricarica per continuare.',
    reload: 'Ricarica',
    home: 'Torna alla home',
    details: 'Dettagli tecnici',
    reset: 'Ancora bloccato? Reimposta i dati dell’app',
    resetConfirm:
      'Questo elimina lo storico degli allenamenti, i prodotti personalizzati e le impostazioni su QUESTO dispositivo. Non si può annullare. Continuare?',
  },
};

function copy(): Copy {
  const saved = safeStorage.getItem(LS_KEY);
  // hasOwn: com "constructor" no storage, `COPY[saved]` era a função Object e o
  // cartão de erro renderizava sem texto nenhum.
  return typeof saved === 'string' && Object.prototype.hasOwnProperty.call(COPY, saved)
    ? COPY[saved as UiLanguage]
    : COPY.en;
}

/**
 * Última saída: apaga tudo que o app guardou (chaves `act.*`) e recarrega.
 *
 * Existe porque o app pode ficar preso numa tela de erro por causa de dado
 * corrompido no próprio storage — e aí recarregar não adianta, o dado ruim
 * continua lá. Limpar "dados do site" pelo navegador resolve, mas quase ninguém
 * sabe fazer. Pede confirmação: é destrutivo e irreversível.
 */
function resetAppData(message: string): void {
  if (!window.confirm(message)) return;
  try {
    const mine: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('act.')) mine.push(k);
    }
    for (const k of mine) localStorage.removeItem(k);
  } catch {
    /* storage negado: não há o que limpar */
  }
  window.location.assign('/');
}

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Só no console: o app não manda telemetria para terceiros de propósito.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const c = copy();
    return (
      // 60vh em vez de tela cheia: este fallback aparece tanto sozinho (falha
      // do provider) quanto dentro do <main>, abaixo da navegação.
      <div className="flex min-h-[60vh] items-center justify-center bg-surface px-4 py-16">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-slate-800 bg-surface-raised p-6 text-center"
        >
          <p className="text-3xl" aria-hidden>
            🎙️
          </p>
          <h1 className="mt-3 text-lg font-semibold text-slate-100">{c.title}</h1>
          <p className="mt-2 text-sm text-slate-400">{c.body}</p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {c.reload}
            </button>
            {/* Navegação dura: o router pode ser justamente o que quebrou. */}
            <a
              href="/"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-surface-overlay"
            >
              {c.home}
            </a>
          </div>

          <button
            type="button"
            onClick={() => resetAppData(c.resetConfirm)}
            className="mt-4 text-xs text-slate-500 underline hover:text-red-400"
          >
            {c.reset}
          </button>

          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
              {c.details}
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-surface p-3 text-[11px] leading-relaxed text-slate-400">
              {error.message || String(error)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
