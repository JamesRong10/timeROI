import { create } from 'zustand';
import { CategoryType } from '../constants/categories';
import { useAuthStore } from './useAuthStore';
import { useStreakStore } from './useStreakStore';
import { isProductive } from '../utils/calculations';
import { supabase } from '../src/lib/supabase';

/**
 * Time entry store.
 *
 * Source of truth:
 * - Logged-in users: Supabase table `public.time_logs` (protected by RLS).
 * - Guest mode: in-memory sample data.
 */
export interface TimeEntry {
  id: string;
  duration: number;
  category: CategoryType;
  date: string; // YYYY-MM-DD
  created_at?: string;
  source?: 'manual' | 'timer';
  notes?: string;
}

type TimeState = {
  entries: TimeEntry[];
  addEntry: (entry: TimeEntry) => void;
  getTodayEntries: () => TimeEntry[];
  hydrateForUser: (userId: string) => Promise<void>;
  hydrateGuest: () => void;
  clear: () => void;
};

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
  if (!entry.created_at) {
    const fallbackMs = Date.parse(`${entry.date}T12:00:00`);
    const createdAt = Number.isFinite(fallbackMs) ? new Date(fallbackMs).toISOString() : new Date().toISOString();
    return { ...entry, created_at: createdAt };
  }
  return entry;
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

export const useTimeStore = create<TimeState>((set, get) => ({
  entries: [],

  addEntry: (entry) => {
    const normalized = normalizeEntry(entry);
    set((state) => ({ entries: [normalized, ...state.entries] }));

    const authState = useAuthStore.getState();
    const identity = authState.user?.id ?? (authState.guest ? 'guest' : null);

    if (identity && isProductive(normalized.category)) {
      void useStreakStore.getState().recordActivity(identity, normalized.date);
    }

    const userId = authState.user?.id;
    if (!userId) return;

    void (async () => {
      const insert = await supabase
        .from('time_logs')
        .insert({
          user_id: userId,
          duration: normalized.duration,
          category: normalized.category,
          // created_at defaults to now()
        })
        .select('id, category, duration, created_at')
        .single();

      if (insert.error) return;

      const serverEntry: TimeEntry = normalizeEntry({
        id: insert.data.id,
        date: String(insert.data.created_at ?? normalized.created_at ?? new Date().toISOString()).split('T')[0],
        duration: insert.data.duration,
        category: insert.data.category as CategoryType,
        notes: undefined,
        created_at: insert.data.created_at ?? undefined,
        source: normalized.source,
      });

      // Replace the optimistic entry by id.
      set((state) => ({
        entries: state.entries.map((e) => (e.id === normalized.id ? serverEntry : e)),
      }));
    })();
  },

  getTodayEntries: () => {
    const today = toDateString(new Date());
    return get().entries.filter((entry) => entry.date === today);
  },

  hydrateForUser: async (userId) => {
    const { data, error } = await supabase
      .from('time_logs')
      .select('id, category, duration, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      set({ entries: [] });
      return;
    }

    const entries: TimeEntry[] = (data ?? []).map((row) =>
      normalizeEntry({
        id: row.id,
        date: String(row.created_at ?? new Date().toISOString()).split('T')[0],
        duration: row.duration,
        category: row.category as CategoryType,
        notes: undefined,
        created_at: row.created_at ?? undefined,
      }),
    );

    set({ entries });
  },

  hydrateGuest: () => set({ entries: sampleData.map(normalizeEntry) }),

  clear: () => set({ entries: [] }),
}));
