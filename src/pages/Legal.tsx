import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LEGAL, type LegalSection } from '@/data/legal';
import { useT } from '@/i18n';

/** Página única com Política de Privacidade e Termos, no idioma da interface. */
export function Legal() {
  const { t, lang } = useT();
  const { hash } = useLocation();
  const doc = LEGAL[lang];

  // Rola até a âncora (#privacy / #terms) quando vem do rodapé.
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [hash]);

  const sections = (list: LegalSection[]) =>
    list.map((s, i) => (
      <div key={i} className="mb-4">
        <h3 className="mb-1 text-sm font-semibold text-slate-200">{s.h}</h3>
        {s.p.map((para, j) => (
          <p key={j} className="mb-1 text-sm leading-relaxed text-slate-400">
            {para}
          </p>
        ))}
      </div>
    ));

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">{t('legal.title')}</h1>
      <p className="mb-8 text-xs text-slate-500">{t('legal.updated', { date: doc.updated })}</p>

      <section id="privacy" className="mb-10 scroll-mt-20">
        <h2 className="mb-3 text-lg font-bold text-slate-100">{t('legal.privacy')}</h2>
        {sections(doc.privacy)}
      </section>

      <section id="terms" className="scroll-mt-20">
        <h2 className="mb-3 text-lg font-bold text-slate-100">{t('legal.terms')}</h2>
        {sections(doc.terms)}
      </section>
    </div>
  );
}
