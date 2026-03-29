/**
 * Minimal "local database" abstraction.
 *
 * Why this exists:
 * - The app needs a simple way to persist auth/session, entries, and preferences.
 * - We intentionally avoid native dependencies here to keep runtime stable across platforms.
 *
 * Storage behavior:
 * - Web: uses `localStorage` (persists across reloads).
 * - Native: falls back to an in-memory Map (resets on app restart).
 *
 * If you want true device persistence on iOS/Android, swap this implementation to AsyncStorage
 * or expo-sqlite once your environment is stable.
 */
type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

// In-memory fallback used when `localStorage` is unavailable (common on native).
const memoryStore = new Map<string, string>();

function getStorage(): StorageLike {
  // Prefer `localStorage` when it exists (web).
  const ls = (globalThis as any)?.localStorage as StorageLike | undefined;
  if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function' && typeof ls.removeItem === 'function') {
    return ls;
  }

  // Fallback storage implementation (native / constrained environments).
  return {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, value) => {
      memoryStore.set(key, value);
    },
    removeItem: (key) => {
      memoryStore.delete(key);
    },
  };
}

export async function initDatabase(): Promise<void> {
  // No-op for local key-value storage.
  // Kept as an async function so callers can share a single init flow.
}

// Basic key/value primitives.
export async function dbGet(key: string): Promise<string | null> {
  return getStorage().getItem(key);
}

export async function dbSet(key: string, value: string): Promise<void> {
  getStorage().setItem(key, value);
}

export async function dbRemove(key: string): Promise<void> {
  getStorage().removeItem(key);
}

// JSON helpers for structured data (arrays/objects).
export async function dbGetJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await dbGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function dbSetJson<T>(key: string, value: T): Promise<void> {
  await dbSet(key, JSON.stringify(value));
}
