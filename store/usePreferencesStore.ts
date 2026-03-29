import { create } from 'zustand';
import { dbGetJson, dbSetJson, initDatabase } from '../utils/db';
import { useAuthStore } from './useAuthStore';

/**
 * Preferences store (simple key/value per user).
 *
 * What it does:
 * - Loads preferences for a user on login.
 * - Persists updates back to local storage.
 *
 * Example future uses:
 * - Theme setting, dashboard layout, default category, hourly rate, etc.
 */
type PreferencesState = {
  ready: boolean;
  values: Record<string, string>;
  hydrateForUser: (userId: string) => Promise<void>;
  setPreference: (key: string, value: string) => Promise<void>;
  getPreference: (key: string) => string | undefined;
  clear: () => void;
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ready: false,
  values: {},

  // Load preference map for the given user id.
  hydrateForUser: async (userId) => {
    await initDatabase();
    const values = await dbGetJson<Record<string, string>>(`prefs:${userId}`, {});
    set({ values, ready: true });
  },

  // Persist a preference update for the currently logged-in user.
  setPreference: async (key, value) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    await initDatabase();
    set((state) => {
      const next = { ...state.values, [key]: value };
      void dbSetJson(`prefs:${userId}`, next);
      return { values: next };
    });
  },

  getPreference: (key) => get().values[key],

  // Clears in-memory preferences (used on logout).
  clear: () => set({ values: {}, ready: false }),
}));
