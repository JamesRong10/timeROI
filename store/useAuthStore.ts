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
  signOut: () => Promise<void>;
  clearError: () => void;
};

const SESSION_KEY = 'session_user_id';
const SESSION_MODE_KEY = 'session_mode';
const USERS_KEY = 'users';

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
        const mode = await dbGet(SESSION_MODE_KEY);
        set({ user: null, guest: mode === 'guest', ready: true });
        return;
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
      await dbSet(SESSION_MODE_KEY, 'user');
      set({ user: { id: userAuth.id, email: userAuth.email }, guest: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Sign in failed' });
      throw e;
    }
  },

  // Clear session and user state.
  signOut: async () => {
    try {
      set({ error: null });
      await setSessionUserId(null);
      await dbRemove(SESSION_MODE_KEY);
      set({ user: null, guest: false });
    } catch (e: any) {
      set({ error: e?.message ?? 'Sign out failed' });
      throw e;
    }
  },
}));
