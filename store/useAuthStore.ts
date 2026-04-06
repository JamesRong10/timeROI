import { create } from 'zustand';
import { dbGet, dbGetJson, dbRemove, dbSet, dbSetJson, initDatabase } from '../utils/db';
import { generateSaltHex, hashPassword, isValidEmail, isValidPassword, normalizeEmail } from '../utils/auth';

/**
 * Auth store (email + password).
 *
 * What it does:
 * - Sign up: validates input, salts + hashes password, stores the user locally.
 * - Sign in: validates credentials against locally stored hash.
 * - Session: stores the active user id so the user stays logged in across reloads (web) or runtime (native).
 *
 * Data storage:
 * - Uses the minimal `utils/db.ts` key/value storage (localStorage or in-memory fallback).
 */
export type AuthUser = {
  id: string;
  email: string;
};

type AuthState = {
  ready: boolean;
  user: AuthUser | null;
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

const SESSION_KEY = 'session_user_id';
const SESSION_MODE_KEY = 'session_mode';
const SESSION_LOGIN_AT_KEY = 'session_login_at';
const USERS_KEY = 'users';
const AUTO_LOGOUT_PREF_KEY = 'auth:auto_logout_policy';

// Small helper to generate unique ids for users.
function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Persist (or clear) the "currently logged in user id".
async function setSessionUserId(userId: string | null) {
  await initDatabase();
  if (!userId) {
    await dbRemove(SESSION_KEY);
    return;
  }
  await dbSet(SESSION_KEY, userId);
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

// Read the "currently logged in user id" if present.
async function getSessionUserId(): Promise<string | null> {
  await initDatabase();
  return dbGet(SESSION_KEY);
}

// How users are stored at rest.
type StoredUser = {
  id: string;
  email: string;
  password_salt: string;
  password_hash: string;
  created_at: string;
};

// Load all users from storage.
async function getAllUsers(): Promise<StoredUser[]> {
  await initDatabase();
  return dbGetJson<StoredUser[]>(USERS_KEY, []);
}

// Save all users back to storage.
async function saveAllUsers(users: StoredUser[]): Promise<void> {
  await initDatabase();
  await dbSetJson(USERS_KEY, users);
}

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
      // Default: weekly.
      return 7 * 24 * 60 * 60 * 1000;
  }
}

// Resolve a session user id to a public user object.
async function getUserById(userId: string): Promise<AuthUser | null> {
  const users = await getAllUsers();
  const u = users.find((x) => x.id === userId);
  if (!u) return null;
  return { id: u.id, email: u.email };
}

// Resolve an email to the auth record needed to verify credentials.
async function getUserAuthByEmail(email: string): Promise<{
  id: string;
  email: string;
  password_salt: string;
  password_hash: string;
} | null> {
  const normalizedEmail = normalizeEmail(email);
  const users = await getAllUsers();
  const u = users.find((x) => x.email === normalizedEmail);
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    password_salt: u.password_salt,
    password_hash: u.password_hash,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  user: null,
  guest: false,
  error: null,

  // Clears the last error so screens don't show stale messages.
  clearError: () => set({ error: null }),

  // Boot-time session loader. Called from `app/_layout.tsx`.
  loadSession: async () => {
    try {
      await initDatabase();
      const sessionUserId = await getSessionUserId();
      if (!sessionUserId) {
        const mode = await dbGet(SESSION_MODE_KEY);
        set({ user: null, guest: mode === 'guest', ready: true });
        return;
      }

      const user = await getUserById(sessionUserId);
      if (!user) {
        await setSessionUserId(null);
        await setSessionLoginAt(null);
        const mode = await dbGet(SESSION_MODE_KEY);
        set({ user: null, guest: mode === 'guest', ready: true });
        return;
      }

      // Enforce auto-logout based on user preference.
      const prefs = await dbGetJson<Record<string, string>>(`prefs:${user.id}`, {});
      const policy = prefs[AUTO_LOGOUT_PREF_KEY] ?? '1w';
      const ttlMs = parseAutoLogoutPolicyToMs(policy);
      if (ttlMs !== null) {
        const now = Date.now();
        const loginAtRaw = await getSessionLoginAt();
        const loginAtMs = loginAtRaw ? Date.parse(loginAtRaw) : NaN;

        // If we don't have a timestamp (or it's invalid), start the clock now to avoid surprise logout.
        if (!Number.isFinite(loginAtMs)) {
          await setSessionLoginAt(new Date(now).toISOString());
        } else if (now - loginAtMs >= ttlMs) {
          await setSessionUserId(null);
          await setSessionLoginAt(null);
          await dbRemove(SESSION_MODE_KEY);
          set({ user: null, guest: false, ready: true });
          return;
        }
      }

      await dbSet(SESSION_MODE_KEY, 'user');
      set({ user, guest: false, ready: true });
    } catch (e: any) {
      set({ user: null, guest: false, ready: true, error: e?.message ?? 'Failed to load session' });
    }
  },

  // Continue into the app without creating an account (guest mode).
  continueAsGuest: async () => {
    await initDatabase();
    await dbRemove(SESSION_KEY);
    await dbRemove(SESSION_LOGIN_AT_KEY);
    await dbSet(SESSION_MODE_KEY, 'guest');
    set({ user: null, guest: true });
  },

  // Create a new local account and log the user in.
  signUp: async (email, password, confirmPassword) => {
    try {
      set({ error: null });
      await initDatabase();

      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid email address.');
      if (!isValidPassword(password)) throw new Error('Password must be at least 6 characters.');
      if (password !== confirmPassword) throw new Error('Passwords do not match.');

      const existing = await getUserAuthByEmail(normalizedEmail);
      if (existing) throw new Error('An account with that email already exists.');

      const userId = makeId('u');
      const salt = await generateSaltHex(16);
      const passwordHash = await hashPassword(password, salt);
      const createdAt = new Date().toISOString();

      const users = await getAllUsers();
      users.push({
        id: userId,
        email: normalizedEmail,
        password_salt: salt,
        password_hash: passwordHash,
        created_at: createdAt,
      });
      await saveAllUsers(users);

      await setSessionUserId(userId);
      await setSessionLoginAt(new Date().toISOString());
      await dbSet(SESSION_MODE_KEY, 'user');
      set({ user: { id: userId, email: normalizedEmail }, guest: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Sign up failed' });
      throw e;
    }
  },

  // Validate credentials and log the user in.
  signIn: async (email, password) => {
    try {
      set({ error: null });
      await initDatabase();

      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid email address.');
      if (!password) throw new Error('Enter your password.');

      const userAuth = await getUserAuthByEmail(normalizedEmail);
      if (!userAuth) throw new Error('No account found for that email.');

      const computedHash = await hashPassword(password, userAuth.password_salt);
      if (computedHash !== userAuth.password_hash) throw new Error('Incorrect password.');

      await setSessionUserId(userAuth.id);
      await setSessionLoginAt(new Date().toISOString());
      await dbSet(SESSION_MODE_KEY, 'user');
      set({ user: { id: userAuth.id, email: userAuth.email }, guest: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Sign in failed' });
      throw e;
    }
  },

  // Updates the logged-in user's email (requires current password).
  updateEmail: async (newEmail, currentPassword) => {
    try {
      set({ error: null });
      await initDatabase();

      const currentUser = get().user;
      if (!currentUser) throw new Error('You must be logged in to update your email.');

      const normalizedEmail = normalizeEmail(newEmail);
      if (!isValidEmail(normalizedEmail)) throw new Error('Enter a valid email address.');
      if (!currentPassword) throw new Error('Enter your current password.');

      const users = await getAllUsers();
      const existingOther = users.find((u) => u.email === normalizedEmail && u.id !== currentUser.id);
      if (existingOther) throw new Error('An account with that email already exists.');

      const idx = users.findIndex((u) => u.id === currentUser.id);
      if (idx < 0) throw new Error('Account not found.');

      const computedHash = await hashPassword(currentPassword, users[idx].password_salt);
      if (computedHash !== users[idx].password_hash) throw new Error('Incorrect password.');

      users[idx] = { ...users[idx], email: normalizedEmail };
      await saveAllUsers(users);
      await setSessionLoginAt(new Date().toISOString());
      set({ user: { id: currentUser.id, email: normalizedEmail } });
    } catch (e: any) {
      set({ error: e?.message ?? 'Update email failed' });
      throw e;
    }
  },

  // Updates the logged-in user's password (requires current password + confirmation).
  changePassword: async (currentPassword, newPassword, confirmNewPassword) => {
    try {
      set({ error: null });
      await initDatabase();

      const currentUser = get().user;
      if (!currentUser) throw new Error('You must be logged in to change your password.');
      if (!currentPassword) throw new Error('Enter your current password.');
      if (!isValidPassword(newPassword)) throw new Error('New password must be at least 6 characters.');
      if (newPassword !== confirmNewPassword) throw new Error('New passwords do not match.');

      const users = await getAllUsers();
      const idx = users.findIndex((u) => u.id === currentUser.id);
      if (idx < 0) throw new Error('Account not found.');

      const computedHash = await hashPassword(currentPassword, users[idx].password_salt);
      if (computedHash !== users[idx].password_hash) throw new Error('Incorrect password.');

      const salt = await generateSaltHex(16);
      const passwordHash = await hashPassword(newPassword, salt);
      users[idx] = { ...users[idx], password_salt: salt, password_hash: passwordHash };
      await saveAllUsers(users);
      await setSessionLoginAt(new Date().toISOString());
    } catch (e: any) {
      set({ error: e?.message ?? 'Change password failed' });
      throw e;
    }
  },

  // Clear session and user state.
  signOut: async () => {
    try {
      set({ error: null });
      await setSessionUserId(null);
      await setSessionLoginAt(null);
      await dbRemove(SESSION_MODE_KEY);
      set({ user: null, guest: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Sign out failed' });
      throw e;
    }
  },
}));
