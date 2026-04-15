import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

type ExpoExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabase?: {
    url?: string;
    anonKey?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
  };
};

function getConfig(): { url: string; anonKey: string } {
  const expoConfigAny = (Constants.expoConfig ?? {}) as any;
  const expoSupabase = (expoConfigAny.supabase ?? {}) as {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    url?: string;
    anonKey?: string;
  };
  const extra = (expoConfigAny.extra ?? {}) as ExpoExtra;

  // Prefer EXPO_PUBLIC_* env vars. These are still embedded in the client bundle,
  // so only use the Supabase *anon* key here (never service role keys).
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    expoSupabase.supabaseUrl ??
    expoSupabase.url ??
    extra.supabaseUrl ??
    extra.supabase?.url ??
    extra.supabase?.supabaseUrl ??
    '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    expoSupabase.supabaseAnonKey ??
    expoSupabase.anonKey ??
    extra.supabaseAnonKey ??
    extra.supabase?.anonKey ??
    extra.supabase?.supabaseAnonKey ??
    '';

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY, or configure expo.supabase in app.json.',
    );
  }

  return { url, anonKey };
}

const { url, anonKey } = getConfig();

function buildStorage() {
  if (Platform.OS !== 'web') return AsyncStorage;

  const ls = (globalThis as any)?.localStorage as Storage | undefined;
  if (!ls) {
    const mem = new Map<string, string>();
    return {
      getItem: async (key: string) => mem.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        mem.set(key, value);
      },
      removeItem: async (key: string) => {
        mem.delete(key);
      },
    };
  }

  return {
    getItem: async (key: string) => ls.getItem(key),
    setItem: async (key: string, value: string) => {
      ls.setItem(key, value);
    },
    removeItem: async (key: string) => {
      ls.removeItem(key);
    },
  };
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: buildStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  },
});
