import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { UiLanguage } from '@/types';
import { pt } from './pt';
import { it } from './it';
import { en } from './en';

export type Dict = typeof pt;
export type TKey = keyof Dict;

const DICTS: Record<UiLanguage, Dict> = { pt, it, en };
const LS_KEY = 'act.ui_lang';

interface I18nCtx {
  lang: UiLanguage;
  setLang: (l: UiLanguage) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLanguage>(() => {
    const saved = localStorage.getItem(LS_KEY) as UiLanguage | null;
    return saved && saved in DICTS ? saved : 'pt';
  });

  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang: (l) => {
        localStorage.setItem(LS_KEY, l);
        setLangState(l);
      },
      t: (key, vars) => {
        let text: string = DICTS[lang][key] ?? DICTS.pt[key] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
          }
        }
        return text;
      },
    }),
    [lang],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useT must be used inside I18nProvider');
  return ctx;
}
