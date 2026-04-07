import { create } from 'zustand';
import { CategoryType } from '../constants/categories';
import { dbGetJson, dbSetJson, initDatabase } from '../utils/db';
import { useAuthStore } from './useAuthStore';
import { useStreakStore } from './useStreakStore';

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
  // Badge-ready fields (optional for backward compatibility).
  created_at?: string; // ISO timestamp for when the entry was recorded
  started_at?: string; // ISO timestamp for focus sessions (future)
  ended_at?: string; // ISO timestamp for focus sessions (future)
  interruptions?: number; // number of interruptions during the session (future)
  time_roi_score?: number; // higher = better ROI (future)
  goal_id?: string; // future: link entry to a daily goal
  project_id?: string; // future: link entry to a long-term project
  source?: 'manual' | 'timer'; // future: distinguish manual vs timer-created entries
  notes?: string; // future: optional notes / task label
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
  { id: 's1', duration: 60, category: 'learning', date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString() },
  { id: 's2', duration: 40, category: 'health', date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString() },
  { id: 's3', duration: 20, category: 'wasted', date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString() },
  {
    id: 's4',
    duration: 120,
    category: 'rest',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  },
];

function normalizeEntry(entry: TimeEntry): TimeEntry {
  // Ensure new optional fields get reasonable defaults for badge computations.
  if (!entry.created_at) {
    const fallbackMs = Date.parse(`${entry.date}T12:00:00`);
    const createdAt = Number.isFinite(fallbackMs) ? new Date(fallbackMs).toISOString() : new Date().toISOString();
    return { ...entry, created_at: createdAt };
  }
  return entry;
}

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
    const normalized = normalizeEntry(entry);
    set((state) => ({
      entries: [normalized, ...state.entries],
    }));

    const authState = useAuthStore.getState();
    const identity = authState.user?.id ?? (authState.guest ? 'guest' : null);

    if (identity) {
      // A day only counts toward a streak if the user logs at least one entry that day.
      void useStreakStore.getState().recordActivity(identity, normalized.date);
    }

    const authUserId = authState.user?.id;
    if (authUserId) {
      // Persist in the background so UI remains responsive.
      void (async () => {
        const existing = await getEntriesForUser(authUserId);
        await saveEntriesForUser(authUserId, [normalized, ...existing]);
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
    set({ entries: entries.map(normalizeEntry) });
  },

  // Guest mode uses in-memory sample data (no persistence).
  hydrateGuest: () => set({ entries: sampleData }),

  // Clears in-memory entries (used on logout).
  clear: () => set({ entries: [] }),
}));
