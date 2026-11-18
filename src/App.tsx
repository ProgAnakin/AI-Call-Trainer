import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { clsx } from 'clsx';
import { I18nProvider, useT } from '@/i18n';
import { isDemoMode } from '@/lib/api';
import type { UiLanguage } from '@/types';
import { LANGUAGE_NAMES } from '@/components/ui';
import { Onboarding } from '@/components/Onboarding';
import { CloudSync } from '@/components/CloudSync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
import { Waveform } from '@/components/call/Waveform';

// Cada rota vira seu próprio chunk — só a página aberta é baixada. O grosso do
// peso (framer-motion na call, o editor da biblioteca) sai do carregamento inicial.
const Home = lazy(() => import('@/pages/Home').then((m) => ({ default: m.Home })));
const Call = lazy(() => import('@/pages/Call').then((m) => ({ default: m.Call })));
const Scorecard = lazy(() => import('@/pages/Scorecard').then((m) => ({ default: m.Scorecard })));
const Progress = lazy(() => import('@/pages/Progress').then((m) => ({ default: m.Progress })));
const Library = lazy(() => import('@/pages/Library').then((m) => ({ default: m.Library })));
const Drill = lazy(() => import('@/pages/Drill').then((m) => ({ default: m.Drill })));
const EmailLab = lazy(() => import('@/pages/EmailLab').then((m) => ({ default: m.EmailLab })));
const Legal = lazy(() => import('@/pages/Legal').then((m) => ({ default: m.Legal })));

/** Link "pular para o conteúdo" — invisível até receber foco por teclado. */
function SkipLink() {
  const { t } = useT();
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
    >
      {t('a11y.skip')}
    </a>
  );
}

function Nav() {
  const { t, lang, setLang } = useT();
  const links = [
    { to: '/', label: t('nav.home') },
    { to: '/drill', label: t('nav.drill') },
    { to: '/email', label: t('nav.email') },
    { to: '/progress', label: t('nav.progress') },
    { to: '/library', label: t('nav.library') },
  ];
  const langs: UiLanguage[] = ['en', 'pt', 'it'];

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-surface/90 backdrop-blur">
      {/* Três filhos diretos com flex-wrap. Antes, logo + 5 links + idioma ficavam
          numa linha única que não quebrava: a 375px a página inteira rolava para o
          lado (554px em inglês, 601px em italiano). Agora, em telas estreitas, a
          navegação desce para uma segunda linha (order-last + w-full) e rola só
          ela, se precisar; de sm para cima o layout é o mesmo de antes. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="text-sm font-bold tracking-tight">
          🎙️ AI Call Trainer
        </Link>
        <nav className="order-last flex w-full gap-1 overflow-x-auto [scrollbar-width:none] sm:order-none sm:w-auto sm:flex-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm transition-colors sm:px-3',
                  isActive ? 'bg-surface-overlay text-white' : 'text-slate-400 hover:text-slate-200',
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {isDemoMode() && (
            <span
              className="hidden rounded-full bg-amber-900/50 px-2.5 py-1 text-[10px] font-medium text-amber-300 sm:inline"
              title={t('app.demoTooltip')}
            >
              {t('app.demoBadge')}
            </span>
          )}
          {/* Visualmente são só "EN/PT/IT". Para um leitor de tela isso era
              "pt, botão", sem dizer que é idioma nem qual está ativo — daí o
              grupo rotulado, o nome completo e o aria-pressed. */}
          <div
            role="group"
            aria-label={t('a11y.langGroup')}
            className="flex gap-0.5 rounded-lg bg-surface-raised p-0.5"
          >
            {langs.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                // Nome do idioma no próprio idioma — é como se espera ver.
                aria-label={LANGUAGE_NAMES[l]}
                aria-pressed={lang === l}
                className={clsx(
                  'rounded-md px-2 py-0.5 text-xs font-medium uppercase transition-colors',
                  lang === l ? 'bg-accent text-white' : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <CloudSync />
        </div>
      </div>
    </header>
  );
}

/**
 * Rota coringa. Sem ela, um endereço inválido (ex.: um link antigo para um
 * cenário apagado) renderizava uma página vazia, sem explicação nem saída.
 * Fica inline em vez de lazy: são poucas linhas e não vale um chunk à parte.
 */
function NotFound() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-4xl" aria-hidden>
        🔍
      </p>
      <h1 className="mt-4 text-xl font-semibold text-slate-100">{t('notFound.title')}</h1>
      <p className="mt-2 text-sm text-slate-400">{t('notFound.body')}</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        {t('notFound.home')}
      </Link>
    </div>
  );
}

/** Placeholder enquanto o chunk da rota carrega — leve e centralizado. */
function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <Waveform active color="bg-accent" />
    </div>
  );
}

export default function App() {
  return (
    // Boundary externo: pega até uma falha do provider de i18n ou da navegação.
    <ErrorBoundary>
      <I18nProvider>
        {/* reducedMotion="user" faz TODO framer-motion respeitar o SO do usuário. */}
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <SkipLink />
            <Onboarding />
            <Nav />
            <main id="main" tabIndex={-1} className="focus:outline-none">
              {/* Boundary interno: uma página quebrada não leva a navegação com
                  ela, então dá para sair pelo menu em vez de recarregar. */}
              <ErrorBoundary>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/drill" element={<Drill />} />
                    <Route path="/email" element={<EmailLab />} />
                    <Route path="/call/:scenarioId" element={<Call />} />
                    <Route path="/scorecard/:sessionId" element={<Scorecard />} />
                    <Route path="/progress" element={<Progress />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/legal" element={<Legal />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </main>
            <Footer />
          </BrowserRouter>
        </MotionConfig>
      </I18nProvider>
    </ErrorBoundary>
  );
}
