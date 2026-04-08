import { create } from 'zustand';
import { dbGetJson, dbSetJson, initDatabase } from '../utils/db';

/**
 * Streak store (daily).
 *
 * How streaks work:
 * - A streak is extended when the user logs at least ONE PRODUCTIVE time entry for a calendar date.
 * - If the user misses an entire calendar date, the streak resets to 0.
 * - "Satisfied today" can be derived by checking `lastActiveDate === today`.
 *
 * Identity:
 * - Logged-in users use their `userId`.
 * - Guest mode uses the fixed identity `"guest"`.
 */
type StreakData = {
  current: number;
  lastActiveDate: string | null; // YYYY-MM-DD
};

type StreakState = {
  identity: string | null;
  current: number;
  lastActiveDate: string | null;
  hydrateForIdentity: (identity: string) => Promise<void>;
  recordActivity: (identity: string, date: string) => Promise<void>;
  clear: () => void;
};

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

function todayString(): string {
  return toDateString(new Date());
}

function yesterdayOf(dateString: string): string {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

// If lastActiveDate is neither today nor yesterday, a calendar day was missed.
function shouldResetStreak(lastActiveDate: string | null, today: string): boolean {
  if (!lastActiveDate) return false;
  if (lastActiveDate === today) return false;
  if (lastActiveDate === yesterdayOf(today)) return false;
  return true;
}

function streakKey(identity: string) {
  return `streak:${identity}`;
}

async function loadStreak(identity: string): Promise<StreakData> {
  await initDatabase();
  return dbGetJson<StreakData>(streakKey(identity), { current: 0, lastActiveDate: null });
}

async function saveStreak(identity: string, data: StreakData): Promise<void> {
  await initDatabase();
  await dbSetJson(streakKey(identity), data);
}

export const useStreakStore = create<StreakState>((set, get) => ({
  identity: null,
  current: 0,
  lastActiveDate: null,

  // Loads the current streak for a given identity (user or guest).
  hydrateForIdentity: async (identity) => {
    const data = await loadStreak(identity);
    const today = todayString();

    // If a full calendar day was missed, reset the streak to 0 until the next activity.
    if (shouldResetStreak(data.lastActiveDate, today) && data.current !== 0) {
      const reset: StreakData = { current: 0, lastActiveDate: data.lastActiveDate };
      await saveStreak(identity, reset);
      set({ identity, current: reset.current, lastActiveDate: reset.lastActiveDate });
      return;
    }

    set({ identity, current: data.current, lastActiveDate: data.lastActiveDate });
  },

  // Records activity for a given calendar date and updates the streak accordingly.
  recordActivity: async (identity, date) => {
    const data = await loadStreak(identity);

    if (data.lastActiveDate === date) {
      set({ identity, current: data.current, lastActiveDate: data.lastActiveDate });
      return;
    }

    const next =
      data.lastActiveDate && yesterdayOf(date) === data.lastActiveDate
        ? { current: Math.max(1, data.current + 1), lastActiveDate: date }
        : { current: 1, lastActiveDate: date };

    await saveStreak(identity, next);
    set({ identity, current: next.current, lastActiveDate: next.lastActiveDate });
  },

  // Clears in-memory streak state (used when logging out).
  clear: () => set({ identity: null, current: 0, lastActiveDate: null }),
}));
