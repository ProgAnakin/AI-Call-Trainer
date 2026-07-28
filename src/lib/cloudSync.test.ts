import { beforeEach, describe, expect, it } from 'vitest';
import { mergeCloudData } from './cloudSync';
import { readBackup } from './storage';

/**
 * Minimal in-memory localStorage for the node test environment — enough for the
 * backup layer (getItem/setItem/removeItem) that mergeCloudData drives.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    new MemoryStorage() as unknown as Storage;
});

describe('mergeCloudData', () => {
  it('is a no-op for non-object payloads', () => {
    expect(mergeCloudData(null)).toBe(0);
    expect(mergeCloudData(undefined)).toBe(0);
    expect(mergeCloudData('nope')).toBe(0);
    expect(mergeCloudData(42)).toBe(0);
  });

  it('merges sessions and reports how many are new', () => {
    const cloud = { version: 1, sessions: [{ id: 's1' }, { id: 's2' }], turns: [], evaluations: [] };
    expect(mergeCloudData(cloud)).toBe(2);
    expect(readBackup().sessions).toHaveLength(2);
  });

  it('is idempotent — pulling the same backup twice adds nothing', () => {
    const cloud = { version: 1, sessions: [{ id: 's1' }, { id: 's2' }] };
    expect(mergeCloudData(cloud)).toBe(2);
    expect(mergeCloudData(cloud)).toBe(0);
    expect(readBackup().sessions).toHaveLength(2);
  });

  it('keeps local-only sessions when pulling different cloud data', () => {
    // A session created on this device.
    mergeCloudData({ sessions: [{ id: 'local' }] });
    // Pulling a cloud row that has a different session must not drop the local one.
    expect(mergeCloudData({ sessions: [{ id: 'cloud' }] })).toBe(1);
    const ids = readBackup().sessions.map((s) => s.id).sort();
    expect(ids).toEqual(['cloud', 'local']);
  });

  it('tolerates partial payloads (missing arrays)', () => {
    expect(mergeCloudData({ sessions: [{ id: 'only' }] })).toBe(1);
    const backup = readBackup();
    expect(backup.sessions).toHaveLength(1);
    expect(backup.turns).toHaveLength(0);
  });
});
