import { supabase } from './supabase';

/**
 * Thin wrapper over Supabase Auth for the optional cross-device sync.
 *
 * Everything here is a no-op when Supabase isn't configured (demo mode), so the
 * app never depends on auth to function — signing in only unlocks the ability
 * to push/pull your training backup to the cloud.
 */

export interface AuthUser {
  id: string;
  email: string;
}

/** Auth is only meaningful when Supabase is wired up. */
export function isAuthAvailable(): boolean {
  return supabase !== null;
}

/** The currently signed-in user, or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !user.email) return null;
  return { id: user.id, email: user.email };
}

/**
 * Sends a passwordless magic link to `email`. The user clicks it on the same
 * device and lands back on the app already signed in.
 */
export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'auth-unavailable' };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * Subscribes to sign-in/sign-out changes. Returns an unsubscribe function.
 * The callback receives the fresh user (or null) so the UI can react.
 */
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    cb(user && user.email ? { id: user.id, email: user.email } : null);
  });
  return () => data.subscription.unsubscribe();
}

/** Loose email sanity check — the real validation is Supabase sending the link. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
