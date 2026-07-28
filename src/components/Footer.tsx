import { Link } from 'react-router-dom';
import { useT } from '@/i18n';

/** Rodapé global com links legais e para o repositório (MIT). */
export function Footer() {
  const { t } = useT();
  return (
    <footer className="mt-16 border-t border-slate-800 py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-xs text-slate-500">
        <span>AI Call Trainer</span>
        <span aria-hidden>·</span>
        <Link to="/legal#privacy" className="transition-colors hover:text-slate-300">
          {t('legal.privacy')}
        </Link>
        <Link to="/legal#terms" className="transition-colors hover:text-slate-300">
          {t('legal.terms')}
        </Link>
        <a
          href="https://github.com/ProgAnakin/AI-Call-Trainer"
          target="_blank"
          rel="noreferrer noopener"
          className="transition-colors hover:text-slate-300"
        >
          GitHub · MIT
        </a>
      </div>
    </footer>
  );
}
