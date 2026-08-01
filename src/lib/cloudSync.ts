import { supabase } from './supabase';
import { readBackup, restoreBackup, type Backup } from './storage';
import type { AuthUser } from './auth';

/**
 * Cross-device sync built on top of the existing backup layer.
 *
 * "Push" writes this device's whole backup (readBackup) into the user's private
 * `user_backups` row. "Pull" reads that row back and merges it into
 * localStorage (restoreBackup) — merge-by-id, so pulling never duplicates rows
 * and local-only sessions survive. localStorage remains the source of truth;
 * the cloud is just the shared copy between a user's devices.
 */

const TABLE = 'user_backups';

/** Hard cap on a synced backup (guards cloud-storage abuse). ~2 MB. */
const MAX_BACKUP_BYTES = 2_000_000;

export type SyncResult =
  | { ok: true; newSessions?: number }
  | { ok: false; error: string };

/** Uploads the full local backup to the signed-in user's cloud row. */
export async function pushBackup(user: AuthUser): Promise<SyncResult> {
  if (!supabase) return { ok: false, error: 'sync-unavailable' };
  const backup = readBackup();
  if (JSON.stringify(backup).length > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'backup-too-large' };
  }
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: user.id, data: backup, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Fetches the cloud backup and merges it into localStorage. */
export async function pullBackup(user: AuthUser): Promise<SyncResult> {
  if (!supabase) return { ok: false, error: 'sync-unavailable' };
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const newSessions = mergeCloudData(data?.data);
  return { ok: true, newSessions };
}

/**
 * Pure merge core: validates the raw cloud payload and folds it into local
 * storage, returning how many new sessions landed. Isolated from the network so
 * it can be unit-tested. A missing or malformed payload is a no-op (returns 0).
 */
export function mergeCloudData(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0;
  return restoreBackup(raw as Partial<Backup>);
}
