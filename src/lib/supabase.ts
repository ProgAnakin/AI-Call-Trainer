import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as safeStorage from '@/lib/safeStorage';

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

/** Fallback em memória quando o storage está negado — ver getDeviceId(). */
let memoryDeviceId: string | null = null;

/**
 * ID anônimo por dispositivo, usado para rate limiting nas Edge Functions.
 *
 * Com storage bloqueado não lança: cai para um id estável apenas nesta aba,
 * assim a call em andamento não é contada como um device novo a cada request
 * (o que furaria o limite por sessão).
 */
export function getDeviceId(): string {
  const stored = safeStorage.getItem(DEVICE_ID_KEY);
  if (stored) return stored;
  memoryDeviceId ??= crypto.randomUUID();
  safeStorage.setItem(DEVICE_ID_KEY, memoryDeviceId); // no-op se bloqueado
  return memoryDeviceId;
}
