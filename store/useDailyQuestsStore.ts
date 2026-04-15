import { create } from 'zustand';
import { dbGetJson, dbSetJson, initDatabase } from '../utils/db';
import { useAuthStore } from './useAuthStore';
import { supabase } from '../src/lib/supabase';

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

const REMOTE_STATE_PREF_KEY = 'daily_quests:state';

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

function safeParseState(raw: string | null | undefined, today: string): StoredDailyQuestState {
  if (!raw) return { date: today, timerStarted: false, maxFocusMinutesCompleted: 0 };
  try {
    const parsed = JSON.parse(raw) as StoredDailyQuestState;
    if (!parsed || typeof parsed !== 'object') return { date: today, timerStarted: false, maxFocusMinutesCompleted: 0 };
    if (parsed.date !== today) return { date: today, timerStarted: false, maxFocusMinutesCompleted: 0 };
    return {
      date: today,
      timerStarted: !!parsed.timerStarted,
      maxFocusMinutesCompleted: Math.max(0, Math.floor(parsed.maxFocusMinutesCompleted ?? 0)),
    };
  } catch {
    return { date: today, timerStarted: false, maxFocusMinutesCompleted: 0 };
  }
}

async function upsertRemoteState(userId: string, state: StoredDailyQuestState) {
  const value = JSON.stringify(state);
  await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, pref_key: REMOTE_STATE_PREF_KEY, pref_value: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,pref_key' },
    );

  // Also write a minimal quest completion record to the `daily_quests` table.
  const date = state.date;
  await supabase.from('daily_quests').upsert(
    [
      { user_id: userId, title: 'use_timer', completed: state.timerStarted, date },
      { user_id: userId, title: 'focus_60', completed: state.maxFocusMinutesCompleted >= 60, date },
    ],
    { onConflict: 'user_id,title,date' },
  );
}

async function loadRemoteTodayState(userId: string): Promise<StoredDailyQuestState> {
  const today = todayString();
  const prefRes = await supabase
    .from('user_preferences')
    .select('pref_value')
    .eq('user_id', userId)
    .eq('pref_key', REMOTE_STATE_PREF_KEY)
    .maybeSingle();

  const state = safeParseState(prefRes.data?.pref_value, today);
  // Ensure there is at least a stored state row.
  await upsertRemoteState(userId, state);
  return state;
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
    const data = identity === 'guest' ? await loadTodayState(identity) : await loadRemoteTodayState(identity);
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

    const data = identity === 'guest' ? await loadTodayState(identity) : await loadRemoteTodayState(identity);
    if (data.timerStarted) {
      set({ identity, date: data.date, timerStarted: true, maxFocusMinutesCompleted: data.maxFocusMinutesCompleted });
      return;
    }

    const next: StoredDailyQuestState = { ...data, timerStarted: true };
    if (identity === 'guest') await saveTodayState(identity, next);
    else await upsertRemoteState(identity, next);
    set({ identity, date: next.date, timerStarted: next.timerStarted, maxFocusMinutesCompleted: next.maxFocusMinutesCompleted });
  },

  recordTimerCompleted: async (durationMinutes) => {
    const identity = getIdentity();
    if (!identity) return;

    const minutes = Math.max(0, Math.floor(durationMinutes));
    const data = identity === 'guest' ? await loadTodayState(identity) : await loadRemoteTodayState(identity);
    const nextMax = Math.max(data.maxFocusMinutesCompleted ?? 0, minutes);

    if (nextMax === (data.maxFocusMinutesCompleted ?? 0)) {
      set({ identity, date: data.date, timerStarted: data.timerStarted, maxFocusMinutesCompleted: data.maxFocusMinutesCompleted });
      return;
    }

    const next: StoredDailyQuestState = { ...data, maxFocusMinutesCompleted: nextMax };
    if (identity === 'guest') await saveTodayState(identity, next);
    else await upsertRemoteState(identity, next);
    set({ identity, date: next.date, timerStarted: next.timerStarted, maxFocusMinutesCompleted: next.maxFocusMinutesCompleted });
  },

  clear: () => set({ identity: null, date: todayString(), timerStarted: false, maxFocusMinutesCompleted: 0 }),
}));
