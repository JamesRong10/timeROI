import { create } from 'zustand';
import { supabase } from '../src/lib/supabase';
import { dbGet, dbGetJson, dbRemove, dbSet, initDatabase } from '../utils/db';
import { isValidEmail, isValidPassword, normalizeEmail } from '../utils/auth';
import type { Session } from '@supabase/supabase-js';
import * as auth from '../src/lib/auth';

export type AuthUser = {
  id: string;
  email: string;
};

type AuthState = {
  loading: boolean;
  user: AuthUser | null;
  session: Session | null;
  guest: boolean;
  error: string | null;
  loadSession: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signUp: (email: string, password: string, confirmPassword: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  updateEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmNewPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const SESSION_MODE_KEY = 'session_mode';
const SESSION_LOGIN_AT_KEY = 'session_login_at';
const AUTO_LOGOUT_PREF_KEY = 'auth:auto_logout_policy';

let authSubscription: { unsubscribe: () => void } | null = null;

function parseAutoLogoutPolicyToMs(policy: string | undefined | null): number | null {
  switch (policy) {
    case '1d':
      return 1 * 24 * 60 * 60 * 1000;
    case '3d':
      return 3 * 24 * 60 * 60 * 1000;
    case '1w':
      return 7 * 24 * 60 * 60 * 1000;
    case '1m':
      return 30 * 24 * 60 * 60 * 1000;
    case 'on_clear':
      return null;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

async function setSessionLoginAt(iso: string | null) {
  await initDatabase();
  if (!iso) {
    await dbRemove(SESSION_LOGIN_AT_KEY);
    return;
  }
  await dbSet(SESSION_LOGIN_AT_KEY, iso);
}

async function getSessionLoginAt(): Promise<string | null> {
  await initDatabase();
  return dbGet(SESSION_LOGIN_AT_KEY);
}

function toAuthUser(user: { id: string; email?: string | null } | null): AuthUser | null {
  if (!user) return null;
  return { id: user.id, email: user.email ?? '' };
}

async function enforceAutoLogoutIfNeeded(userId: string): Promise<boolean> {
  const prefs = await dbGetJson<Record<string, string>>(`prefs:${userId}`, {});
  const policy = prefs[AUTO_LOGOUT_PREF_KEY] ?? '1w';
  const ttlMs = parseAutoLogoutPolicyToMs(policy);
  if (ttlMs === null) return false;

  const now = Date.now();
  const loginAtRaw = await getSessionLoginAt();
  const loginAtMs = loginAtRaw ? Date.parse(loginAtRaw) : NaN;

  if (!Number.isFinite(loginAtMs)) {
    await setSessionLoginAt(new Date(now).toISOString());
    return false;
  }

  if (now - loginAtMs >= ttlMs) {
    await supabase.auth.signOut();
    await setSessionLoginAt(null);
    await dbRemove(SESSION_MODE_KEY);
    return true;
  }

  return false;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  loading: true,
  user: null,
  session: null,
  guest: false,
  error: null,

  clearError: () => set({ error: null }),

  loadSession: async () => {
    try {
      await initDatabase();
      set({ loading: true });

      // Keep guest mode across reloads.
      const mode = await dbGet(SESSION_MODE_KEY);
      if (mode === 'guest') {
        set({ user: null, session: null, guest: true, loading: false, error: null });
        return;
      }

      // Subscribe once so we track sign-in/out changes coming from Supabase.
      if (!authSubscription) {
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          const nextUser = toAuthUser(session?.user ?? null);
          set({ user: nextUser, session: session ?? null, guest: false });
        });
        authSubscription = data.subscription;
      }

      const session = await auth.getSession();
      const sessionUser = toAuthUser(session?.user ?? null);
      if (!sessionUser) {
        set({ user: null, session: null, guest: false, loading: false, error: null });
        return;
      }

      const loggedOut = await enforceAutoLogoutIfNeeded(sessionUser.id);
      if (loggedOut) {
        set({ user: null, session: null, guest: false, loading: false, error: null });
        return;
      }

      await dbSet(SESSION_MODE_KEY, 'user');
      set({ user: sessionUser, session, guest: false, loading: false, error: null });
    } catch (e: any) {
      set({ user: null, session: null, guest: false, loading: false, error: e?.message ?? 'Failed to load session' });
    }
  },

  continueAsGuest: async () => {
    await initDatabase();
    await auth.signOut();
    await setSessionLoginAt(null);
    await dbSet(SESSION_MODE_KEY, 'guest');
    set({ user: null, session: null, guest: true, error: null, loading: false });
  },

  signUp: async (email, password, confirmPassword) => {
    try {
      set({ error: null });
      await initDatabase();

      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid email address.');
      if (!isValidPassword(password)) throw new Error('Password must be at least 6 characters.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');

      const { data, error } = await auth.signUp(normalizedEmail, password);
      if (error) throw error;

      // If email confirmation is enabled in Supabase, `session` can be null.
      if (!data.session?.user) {
        throw new Error('Check your email to confirm your account, then sign in.');
      }

      await setSessionLoginAt(new Date().toISOString());
      await dbSet(SESSION_MODE_KEY, 'user');
      set({ user: toAuthUser(data.session.user), session: data.session, guest: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Sign up failed' });
      throw e;
    }
  },

  signIn: async (email, password) => {
    try {
      set({ error: null });
      await initDatabase();

      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid email address.');
      if (!password) throw new Error('Enter your password.');

      const { data, error } = await auth.signIn(normalizedEmail, password);
      if (error) throw error;
      if (!data.session?.user) throw new Error('Sign in failed.');

      await setSessionLoginAt(new Date().toISOString());
      await dbSet(SESSION_MODE_KEY, 'user');
      set({ user: toAuthUser(data.session.user), session: data.session, guest: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Sign in failed' });
      throw e;
    }
  },

  updateEmail: async (newEmail, currentPassword) => {
    try {
      set({ error: null });
      await initDatabase();

      const currentUser = get().user;
      if (!currentUser) throw new Error('You must be logged in to update your email.');

      const normalizedEmail = normalizeEmail(newEmail);
      if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid email address.');
      if (!currentPassword) throw new Error('Enter your current password.');

      // Re-authenticate (Supabase doesn’t require this by default, but it matches the UI expectation).
      const reauth = await auth.signIn(currentUser.email, currentPassword);
      if (reauth.error) throw reauth.error;

      const { data, error } = await supabase.auth.updateUser({ email: normalizedEmail });
      if (error) throw error;
      if (!data.user) throw new Error('Update failed.');

      await setSessionLoginAt(new Date().toISOString());
      set({ user: toAuthUser(data.user) });
    } catch (e: any) {
      set({ error: e?.message ?? 'Update email failed' });
      throw e;
    }
  },

  changePassword: async (currentPassword, newPassword, confirmNewPassword) => {
    try {
      set({ error: null });
      await initDatabase();

      const currentUser = get().user;
      if (!currentUser) throw new Error('You must be logged in to change your password.');
      if (!currentPassword) throw new Error('Enter your current password.');
      if (!isValidPassword(newPassword)) throw new Error('New password must be at least 6 characters.');
      if (newPassword !== confirmNewPassword) throw new Error('New passwords do not match.');

      const reauth = await auth.signIn(currentUser.email, currentPassword);
      if (reauth.error) throw reauth.error;

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      await setSessionLoginAt(new Date().toISOString());
    } catch (e: any) {
      set({ error: e?.message ?? 'Change password failed' });
      throw e;
    }
  },

  signOut: async () => {
    try {
      set({ error: null });
      await initDatabase();
      await auth.signOut();
      await setSessionLoginAt(null);
      await dbRemove(SESSION_MODE_KEY);
      set({ user: null, session: null, guest: false, loading: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Sign out failed' });
      throw e;
    }
  },
}));
