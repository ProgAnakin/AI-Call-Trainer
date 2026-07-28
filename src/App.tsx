import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { clsx } from 'clsx';
import { I18nProvider, useT } from '@/i18n';
import { isDemoMode } from '@/lib/api';
import type { UiLanguage } from '@/types';
import { Onboarding } from '@/components/Onboarding';
import { CloudSync } from '@/components/CloudSync';
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
    { to: '/progress', label: t('nav.progress') },
    { to: '/library', label: t('nav.library') },
  ];
  const langs: UiLanguage[] = ['pt', 'it', 'en'];

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-sm font-bold tracking-tight">
            🎙️ AI Call Trainer
          </Link>
          <nav className="flex gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'rounded-lg px-3 py-1.5 text-sm transition-colors',
                    isActive ? 'bg-surface-overlay text-white' : 'text-slate-400 hover:text-slate-200',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isDemoMode() && (
            <span
              className="hidden rounded-full bg-amber-900/50 px-2.5 py-1 text-[10px] font-medium text-amber-300 sm:inline"
              title={t('app.demoTooltip')}
            >
              {t('app.demoBadge')}
            </span>
          )}
          <div className="flex gap-0.5 rounded-lg bg-surface-raised p-0.5">
            {langs.map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
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
    <I18nProvider>
      {/* reducedMotion="user" faz TODO framer-motion respeitar o SO do usuário. */}
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <SkipLink />
          <Onboarding />
          <Nav />
          <main id="main" tabIndex={-1} className="focus:outline-none">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/drill" element={<Drill />} />
                <Route path="/call/:scenarioId" element={<Call />} />
                <Route path="/scorecard/:sessionId" element={<Scorecard />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/library" element={<Library />} />
                <Route path="/legal" element={<Legal />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </BrowserRouter>
      </MotionConfig>
    </I18nProvider>
  );
}
