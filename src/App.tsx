import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { clsx } from 'clsx';
import { I18nProvider, useT } from '@/i18n';
import { isDemoMode } from '@/lib/api';
import type { UiLanguage } from '@/types';
import { Home } from '@/pages/Home';
import { Call } from '@/pages/Call';
import { Scorecard } from '@/pages/Scorecard';
import { Progress } from '@/pages/Progress';
import { Library } from '@/pages/Library';
import { Drill } from '@/pages/Drill';

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
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/drill" element={<Drill />} />
            <Route path="/call/:scenarioId" element={<Call />} />
            <Route path="/scorecard/:sessionId" element={<Scorecard />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/library" element={<Library />} />
          </Routes>
        </main>
      </BrowserRouter>
    </I18nProvider>
  );
}
