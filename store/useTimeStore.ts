import { create } from 'zustand';
import { CategoryType } from '../constants/categories';
import { dbGetJson, dbSetJson, initDatabase } from '../utils/db';
import { useAuthStore } from './useAuthStore';

/**
 * Time entry store.
 *
 * What it does:
 * - Holds `entries` in memory for the current session.
 * - Persists entries per-user to local storage.
 * - Hydrates entries when a user logs in (triggered from `app/(tabs)/_layout.tsx`).
 */
export interface TimeEntry {
  id: string;
  duration: number;
  category: CategoryType;
  date: string;
}

interface TimeState {
  entries: TimeEntry[];
  addEntry: (entry: TimeEntry) => void;
  getTodayEntries: () => TimeEntry[];
  hydrateForUser: (userId: string) => Promise<void>;
  hydrateGuest: () => void;
  clear: () => void;
}

const sampleData: TimeEntry[] = [
  { id: 's1', duration: 60, category: 'learning', date: new Date().toISOString().split('T')[0] },
  { id: 's2', duration: 40, category: 'health', date: new Date().toISOString().split('T')[0] },
  { id: 's3', duration: 20, category: 'wasted', date: new Date().toISOString().split('T')[0] },
  { id: 's4', duration: 120, category: 'rest', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
];

// Storage key namespace for per-user entry lists.
function entriesKey(userId: string) {
  return `time_entries:${userId}`;
}

// Load entries for a given user from storage.
async function getEntriesForUser(userId: string): Promise<TimeEntry[]> {
  await initDatabase();
  return dbGetJson<TimeEntry[]>(entriesKey(userId), []);
}

// Save entries for a given user to storage.
async function saveEntriesForUser(userId: string, entries: TimeEntry[]) {
  await initDatabase();
  await dbSetJson(entriesKey(userId), entries);
}

// Optional seed so the app isn't empty for first-time users.
async function seedIfEmpty(userId: string) {
  const current = await getEntriesForUser(userId);
  if (current.length > 0) return;
  await saveEntriesForUser(userId, sampleData);
}

export const useTimeStore = create<TimeState>((set, get) => ({
  entries: [],

  // Adds an entry to in-memory state and persists it for the current user (if logged in).
  addEntry: (entry) => {
    set((state) => ({
      entries: [entry, ...state.entries],
    }));

    const authUserId = useAuthStore.getState().user?.id;
    if (authUserId) {
      // Persist in the background so UI remains responsive.
      void (async () => {
        const existing = await getEntriesForUser(authUserId);
        await saveEntriesForUser(authUserId, [entry, ...existing]);
      })();
    }
  },

  // Keep the function, but don't call it inside the selector
  // Returns today's entries from the current in-memory list.
  getTodayEntries: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().entries.filter((entry) => entry.date === today);
  },

  // Called after login to load entries for the current user.
  hydrateForUser: async (userId) => {
    await initDatabase();
    await seedIfEmpty(userId);
    const entries = await getEntriesForUser(userId);
    set({ entries });
  },

  // Guest mode uses in-memory sample data (no persistence).
  hydrateGuest: () => set({ entries: sampleData }),

  // Clears in-memory entries (used on logout).
  clear: () => set({ entries: [] }),
}));
