/**
 * Minimal "local database" abstraction.
 *
 * Why this exists:
 * - The app needs a simple way to persist auth/session, entries, and preferences.
 * - We intentionally avoid native dependencies here to keep runtime stable across platforms.
 *
 * Storage behavior:
 * - Web: uses `localStorage` (persists across reloads).
 * - Native: uses AsyncStorage when available; otherwise falls back to an in-memory Map.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

type StorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// In-memory fallback used when `localStorage` is unavailable (common on native).
const memoryStore = new Map<string, string>();

function getStorage(): StorageLike {
  // Prefer `localStorage` when it exists (web).
  const ls = (globalThis as any)?.localStorage as Storage | undefined;
  if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function' && typeof ls.removeItem === 'function') {
    return {
      getItem: async (key) => ls.getItem(key),
      setItem: async (key, value) => {
        ls.setItem(key, value);
      },
      removeItem: async (key) => {
        ls.removeItem(key);
      },
    };
  }

  // Native: AsyncStorage when available.
  if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
    return AsyncStorage as unknown as StorageLike;
  }

  // Fallback storage implementation (constrained environments).
  return {
    getItem: async (key) => memoryStore.get(key) ?? null,
    setItem: async (key, value) => {
      memoryStore.set(key, value);
    },
    removeItem: async (key) => {
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
  await getStorage().setItem(key, value);
}

export async function dbRemove(key: string): Promise<void> {
  await getStorage().removeItem(key);
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
