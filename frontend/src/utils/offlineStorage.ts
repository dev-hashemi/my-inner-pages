import { JournalEntry } from '@/types';

export const STORAGE_KEY = 'my-inner-pages-unsynced-journals';
export const OWNER_KEY = 'my-inner-pages-unsynced-owner';

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined = undefined;
let cachedSnapshot: Record<string | number, JournalEntry> = {};

function notifyListeners(): void {
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      notifyListeners();
    }
  });
}

export function subscribeUnsyncedChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUnsyncedEntriesSnapshot(): Record<string | number, JournalEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) {
      return cachedSnapshot;
    }
    cachedRaw = raw;
    cachedSnapshot = raw ? JSON.parse(raw) : {};
    return cachedSnapshot;
  } catch (e) {
    console.error('Failed to parse unsynced journals:', e);
    cachedRaw = undefined;
    cachedSnapshot = {};
    return cachedSnapshot;
  }
}

export function getUnsyncedEntries(): Record<string | number, JournalEntry> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('Failed to parse unsynced journals:', e);
    return {};
  }
}

export function saveUnsyncedEntry(entry: JournalEntry): void {
  try {
    const current = getUnsyncedEntries();
    current[entry.id] = {
      ...entry,
      created_at: entry.created_at || new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    notifyListeners();
  } catch (e) {
    console.error('Failed to save unsynced journal:', e);
  }
}

export function removeUnsyncedEntry(id: string | number): void {
  try {
    const current = getUnsyncedEntries();
    delete current[id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    notifyListeners();
  } catch (e) {
    console.error('Failed to remove unsynced journal:', e);
  }
}

export function isEntryUnsynced(id: string | number): boolean {
  const current = getUnsyncedEntries();
  return !!current[id];
}

export function getOfflineOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function clearUnsyncedEntries(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OWNER_KEY);
    notifyListeners();
  } catch (e) {
    console.error('Failed to clear unsynced journals:', e);
  }
}

/**
 * Bind offline storage to the active user. If a different user logs into the
 * same browser without an explicit logout, wipe the previous user's unsynced
 * queue so private entries are never synced into another account.
 */
export function ensureOfflineOwner(userId: string): void {
  try {
    const existingOwner = localStorage.getItem(OWNER_KEY);
    if (existingOwner && existingOwner !== userId) {
      localStorage.removeItem(STORAGE_KEY);
      notifyListeners();
    }
    localStorage.setItem(OWNER_KEY, userId);
  } catch (e) {
    console.error('Failed to set offline owner:', e);
  }
}

export function getJournalDbName(entryId: string | number, userId?: string | null): string {
  const owner = userId ?? getOfflineOwner();
  return owner
    ? `my-inner-pages-journal-${owner}-${entryId}`
    : `my-inner-pages-journal-${entryId}`;
}

export function deleteJournalIndexedDb(dbName: string): void {
  try {
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase(dbName);
    }
  } catch {
    // Ignore IDB deletion errors in restricted contexts
  }
}
