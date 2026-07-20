import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Cliente Supabase — null quando as env vars não estão configuradas.
 * Nesse caso o app roda em "modo demo": prospect/avaliador simulados
 * localmente e persistência via localStorage.
 */
export const supabase: SupabaseClient | null =
  url && anonKey && !url.includes('SEU-PROJETO') ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = supabase !== null;

const DEVICE_ID_KEY = 'act.device_id';

/** ID anônimo por dispositivo, usado para rate limiting nas Edge Functions. */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
