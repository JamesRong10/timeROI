import { create } from 'zustand';
import { dbGetJson, dbSetJson, initDatabase } from '../utils/db';
import { useAuthStore } from './useAuthStore';

export type DailyQuestId = 'extend_streak' | 'log_30' | 'use_timer' | 'focus_60' | 'match_prev_day' | 'relax_10';

export type DailyQuestDefinition = {
  id: DailyQuestId;
  title: string;
  description: string;
};

const ROTATING_QUESTS: DailyQuestDefinition[] = [
  { id: 'log_30', title: 'Log 30 minutes', description: 'Log at least 30 minutes of activity today.' },
  { id: 'use_timer', title: 'Use the timer', description: 'Start the Focus Timer at least once today.' },
  { id: 'focus_60', title: 'Focus 60+ minutes', description: 'Complete a Focus Timer session of 60+ minutes.' },
  { id: 'match_prev_day', title: 'Match yesterday', description: "Match or beat yesterday's productive minutes." },
  { id: 'relax_10', title: 'Relax 10 minutes', description: 'Log at least 10 minutes of Rest (games/relaxing).' },
];

export function getDailyQuestDefinitionsForDate(_date: string): DailyQuestDefinition[] {
  const today = { id: 'extend_streak', title: 'Extend your streak', description: 'Log at least one productive entry today.' } satisfies DailyQuestDefinition;
  return [today, ...pickRotatingQuests(_date, 2)];
}

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

function todayString(): string {
  return toDateString(new Date());
}

function dateSeed(dateString: string): number {
  // Deterministic seed based on the date string, no crypto needed.
  let h = 0;
  for (let i = 0; i < dateString.length; i += 1) {
    h = (h * 31 + dateString.charCodeAt(i)) >>> 0;
  }
  return h;
}

function pickRotatingQuests(dateString: string, count: number): DailyQuestDefinition[] {
  const n = ROTATING_QUESTS.length;
  if (n === 0) return [];
  if (count >= n) return ROTATING_QUESTS.slice();

  const seed = dateSeed(dateString);
  const first = seed % n;
  let second = (seed * 7 + 3) % n;
  if (second === first) second = (second + 1) % n;

  const picked = [ROTATING_QUESTS[first], ROTATING_QUESTS[second]];
  return picked.slice(0, count);
}

type StoredDailyQuestState = {
  date: string; // YYYY-MM-DD
  timerStarted: boolean;
  maxFocusMinutesCompleted: number;
};

type DailyQuestsState = {
  identity: string | null;
  date: string;
  timerStarted: boolean;
  maxFocusMinutesCompleted: number;
  hydrateForIdentity: (identity: string) => Promise<void>;
  recordTimerStart: () => Promise<void>;
  recordTimerCompleted: (durationMinutes: number) => Promise<void>;
  clear: () => void;
};

function questsKey(identity: string) {
  return `daily_quests:${identity}`;
}

async function loadTodayState(identity: string): Promise<StoredDailyQuestState> {
  await initDatabase();
  const today = todayString();
  const raw = await dbGetJson<StoredDailyQuestState>(questsKey(identity), {
    date: today,
    timerStarted: false,
    maxFocusMinutesCompleted: 0,
  });

  if (raw.date !== today) {
    const reset: StoredDailyQuestState = { date: today, timerStarted: false, maxFocusMinutesCompleted: 0 };
    await dbSetJson(questsKey(identity), reset);
    return reset;
  }

  return raw;
}

async function saveTodayState(identity: string, data: StoredDailyQuestState): Promise<void> {
  await initDatabase();
  await dbSetJson(questsKey(identity), data);
}

function getIdentity(): string | null {
  const auth = useAuthStore.getState();
  return auth.user?.id ?? (auth.guest ? 'guest' : null);
}

export const useDailyQuestsStore = create<DailyQuestsState>((set, get) => ({
  identity: null,
  date: todayString(),
  timerStarted: false,
  maxFocusMinutesCompleted: 0,

  hydrateForIdentity: async (identity) => {
    const data = await loadTodayState(identity);
    set({
      identity,
      date: data.date,
      timerStarted: data.timerStarted,
      maxFocusMinutesCompleted: data.maxFocusMinutesCompleted,
    });
  },

  recordTimerStart: async () => {
    const identity = getIdentity();
    if (!identity) return;

    const data = await loadTodayState(identity);
    if (data.timerStarted) {
      set({ identity, date: data.date, timerStarted: true, maxFocusMinutesCompleted: data.maxFocusMinutesCompleted });
      return;
    }

    const next: StoredDailyQuestState = { ...data, timerStarted: true };
    await saveTodayState(identity, next);
    set({ identity, date: next.date, timerStarted: next.timerStarted, maxFocusMinutesCompleted: next.maxFocusMinutesCompleted });
  },

  recordTimerCompleted: async (durationMinutes) => {
    const identity = getIdentity();
    if (!identity) return;

    const minutes = Math.max(0, Math.floor(durationMinutes));
    const data = await loadTodayState(identity);
    const nextMax = Math.max(data.maxFocusMinutesCompleted ?? 0, minutes);

    if (nextMax === (data.maxFocusMinutesCompleted ?? 0)) {
      set({ identity, date: data.date, timerStarted: data.timerStarted, maxFocusMinutesCompleted: data.maxFocusMinutesCompleted });
      return;
    }

    const next: StoredDailyQuestState = { ...data, maxFocusMinutesCompleted: nextMax };
    await saveTodayState(identity, next);
    set({ identity, date: next.date, timerStarted: next.timerStarted, maxFocusMinutesCompleted: next.maxFocusMinutesCompleted });
  },

  clear: () => set({ identity: null, date: todayString(), timerStarted: false, maxFocusMinutesCompleted: 0 }),
}));

