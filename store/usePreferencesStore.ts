import { create } from 'zustand';
import { dbGetJson, dbSetJson, initDatabase } from '../utils/db';
import { useAuthStore } from './useAuthStore';
import { supabase } from '../src/lib/supabase';

/**
 * Preferences store (simple key/value per user).
 *
 * Source of truth:
 * - Supabase table `public.user_preferences` (protected by RLS).
 *
 * Local cache:
 * - Stored under `prefs:${userId}` so we can render quickly and support features like auto-logout.
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

async function upsertPreference(userId: string, key: string, value: string) {
  await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, pref_key: key, pref_value: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,pref_key' },
    );
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ready: false,
  values: {},

  hydrateForUser: async (userId) => {
    await initDatabase();

    // Load cached preferences first so UI is responsive.
    const cached = await dbGetJson<Record<string, string>>(`prefs:${userId}`, {});
    set({ values: cached, ready: true });

    // Then refresh from Supabase.
    const { data, error } = await supabase
      .from('user_preferences')
      .select('pref_key, pref_value')
      .eq('user_id', userId);

    if (error) return;

    const values: Record<string, string> = {};
    for (const row of data ?? []) {
      values[row.pref_key] = row.pref_value;
    }

    await dbSetJson(`prefs:${userId}`, values);
    set({ values, ready: true });
  },

  setPreference: async (key, value) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    await initDatabase();

    set((state) => {
      const next = { ...state.values, [key]: value };
      void dbSetJson(`prefs:${userId}`, next);
      void upsertPreference(userId, key, value);
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
      void upsertPreference(userId, key, String(nextValue));
      return { values: next };
    });
  },

  recordFeatureUse: async (featureId) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    await initDatabase();

    set((state) => {
      const current = new Set(safeParseStringArray(state.values[FEATURE_USAGE_KEY]));
      current.add(featureId);
      const nextValue = JSON.stringify(Array.from(current).sort());
      const next = { ...state.values, [FEATURE_USAGE_KEY]: nextValue };
      void dbSetJson(`prefs:${userId}`, next);
      void upsertPreference(userId, FEATURE_USAGE_KEY, nextValue);
      return { values: next };
    });
  },

  mergeJsonObjectPreference: async (key, patch) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    await initDatabase();

    set((state) => {
      const current = safeParseStringMap(state.values[key]);
      const nextObj = { ...current, ...patch };
      const nextValue = JSON.stringify(nextObj);
      const next = { ...state.values, [key]: nextValue };
      void dbSetJson(`prefs:${userId}`, next);
      void upsertPreference(userId, key, nextValue);
      return { values: next };
    });
  },

  clear: () => set({ values: {}, ready: false }),
}));

