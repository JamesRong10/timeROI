import { create } from 'zustand';
import { dbGetJson, dbSetJson, initDatabase } from '../utils/db';

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

function yesterdayOf(dateString: string): string {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return toDateString(d);
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

  hydrateForIdentity: async (identity) => {
    const data = await loadStreak(identity);
    set({ identity, current: data.current, lastActiveDate: data.lastActiveDate });
  },

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

  clear: () => set({ identity: null, current: 0, lastActiveDate: null }),
}));

