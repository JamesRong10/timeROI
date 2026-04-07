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
  incrementPreferenceNumber: (key: string, delta?: number) => Promise<void>;
  recordFeatureUse: (featureId: string) => Promise<void>;
  mergeJsonObjectPreference: (key: string, patch: Record<string, string>) => Promise<void>;
  clear: () => void;
};

const FEATURE_USAGE_KEY = 'usage:features';

function safeParseStringArray(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function safeParseStringMap(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

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

  incrementPreferenceNumber: async (key, delta = 1) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    await initDatabase();
    set((state) => {
      const currentRaw = state.values[key];
      const current = currentRaw ? Number.parseInt(currentRaw, 10) : 0;
      const nextValue = (Number.isFinite(current) ? current : 0) + delta;
      const next = { ...state.values, [key]: String(nextValue) };
      void dbSetJson(`prefs:${userId}`, next);
      return { values: next };
    });
  },

  // Records a visited feature to support future "Explorer" badge logic.
  recordFeatureUse: async (featureId) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    await initDatabase();
    set((state) => {
      const current = new Set(safeParseStringArray(state.values[FEATURE_USAGE_KEY]));
      current.add(featureId);
      const next = { ...state.values, [FEATURE_USAGE_KEY]: JSON.stringify(Array.from(current).sort()) };
      void dbSetJson(`prefs:${userId}`, next);
      return { values: next };
    });
  },

  // Merges a JSON object preference `{[key: string]: string}` with the provided patch.
  // Used for badge unlock timestamps, etc.
  mergeJsonObjectPreference: async (key, patch) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    await initDatabase();
    set((state) => {
      const current = safeParseStringMap(state.values[key]);
      const nextObj = { ...current, ...patch };
      const next = { ...state.values, [key]: JSON.stringify(nextObj) };
      void dbSetJson(`prefs:${userId}`, next);
      return { values: next };
    });
  },

  // Clears in-memory preferences (used on logout).
  clear: () => set({ values: {}, ready: false }),
}));
