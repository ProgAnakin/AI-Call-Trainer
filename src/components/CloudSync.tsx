import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import {
  getCurrentUser,
  isAuthAvailable,
  looksLikeEmail,
  onAuthChange,
  sendMagicLink,
  signOut,
  type AuthUser,
} from '@/lib/auth';
import { pullBackup, pushBackup } from '@/lib/cloudSync';
import { Button, Input } from '@/components/ui';
import { useT } from '@/i18n';

/**
 * Optional cross-device sync, surfaced as a small header dropdown.
 *
 * Renders nothing in demo mode (no Supabase = no auth), so it never gets in the
 * way of the zero-config local experience. Signed out: email magic link.
 * Signed in: push/pull the training backup to/from the cloud.
 */
export function CloudSync() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthAvailable()) return;
    void getCurrentUser().then(setUser);
    return onAuthChange((u) => {
      setUser(u);
      setStatus(null);
    });
  }, []);

  // Close on click outside. A `fixed inset-0` backdrop can't be used here: the
  // header's `backdrop-blur` establishes a containing block, which would trap
  // the overlay inside the header instead of covering the viewport.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Demo mode: no cloud, nothing to show.
  if (!isAuthAvailable()) return null;

  const send = async () => {
    if (!looksLikeEmail(email)) {
      setStatus(t('sync.invalidEmail'));
      return;
    }
    setBusy(true);
    setStatus(t('sync.sending'));
    const res = await sendMagicLink(email);
    setBusy(false);
    setStatus(res.ok ? t('sync.linkSent') : t('sync.error'));
  };

  const push = async () => {
    if (!user) return;
    setBusy(true);
    setStatus(t('sync.working'));
    const res = await pushBackup(user);
    setBusy(false);
    setStatus(res.ok ? t('sync.pushed') : t('sync.error'));
  };

  const pull = async () => {
    if (!user) return;
    setBusy(true);
    setStatus(t('sync.working'));
    const res = await pullBackup(user);
    setBusy(false);
    if (res.ok) {
      setStatus(t('sync.pulled', { n: res.newSessions ?? 0 }));
      // Reload so every page picks up the merged data.
      setTimeout(() => window.location.reload(), 900);
    } else {
      setStatus(t('sync.error'));
    }
  };

  const leave = async () => {
    setBusy(true);
    await signOut();
    setUser(null);
    setBusy(false);
    setStatus(null);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
          user
            ? 'bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60'
            : 'bg-surface-raised text-slate-400 hover:text-slate-200',
        )}
        title={t('sync.title')}
      >
        {user ? '☁✓' : '☁'} <span className="hidden sm:inline">{t('sync.button')}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-slate-800 bg-surface-raised p-4 shadow-xl">
          <p className="mb-1 text-sm font-semibold text-slate-100">{t('sync.title')}</p>

          {user ? (
            <>
              <p className="mb-3 text-xs text-slate-400">{t('sync.signedInAs', { email: user.email })}</p>
              <div className="grid gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => void push()}>
                  ⬆ {t('sync.push')}
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => void pull()}>
                  ⬇ {t('sync.pull')}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => void leave()}>
                  {t('sync.signOut')}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-400">{t('sync.subtitle')}</p>
              <Input
                type="email"
                value={email}
                placeholder={t('sync.emailPlaceholder')}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void send()}
              />
              <Button className="mt-2 w-full" disabled={busy} onClick={() => void send()}>
                {t('sync.sendLink')}
              </Button>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">🔒 {t('sync.privacy')}</p>
            </>
          )}

          {status && <p className="mt-3 text-xs text-slate-300">{status}</p>}
        </div>
      )}
    </div>
  );
}
