import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { TimeEntry } from '../store/useTimeStore';
import { getDailyQuestDefinitionsForDate, DailyQuestId } from '../store/useDailyQuestsStore';

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

function yesterdayOf(dateString: string): string {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

function minutesForCategory(entries: TimeEntry[], category: TimeEntry['category']): number {
  return entries.filter((e) => e.category === category).reduce((sum, e) => sum + e.duration, 0);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

type Props = {
  todayEntries: TimeEntry[];
  allEntries: TimeEntry[];
  streakSatisfiedToday: boolean;
  productiveMinutesToday: number;
  timerStartedToday: boolean;
  maxFocusMinutesCompletedToday: number;
};

type QuestStatus = {
  completed: boolean;
  progress: number; // 0..1
  detail: string;
};

function computeStatus(args: {
  questId: DailyQuestId;
  today: string;
  todayEntries: TimeEntry[];
  allEntries: TimeEntry[];
  streakSatisfiedToday: boolean;
  productiveMinutesToday: number;
  timerStartedToday: boolean;
  maxFocusMinutesCompletedToday: number;
}): QuestStatus {
  const {
    questId,
    today,
    todayEntries,
    allEntries,
    streakSatisfiedToday,
    productiveMinutesToday,
    timerStartedToday,
    maxFocusMinutesCompletedToday,
  } = args;

  switch (questId) {
    case 'extend_streak': {
      return {
        completed: streakSatisfiedToday,
        progress: streakSatisfiedToday ? 1 : 0,
        detail: streakSatisfiedToday ? 'Done' : 'Log 1 productive entry',
      };
    }
    case 'log_30': {
      const total = todayEntries.reduce((sum, e) => sum + e.duration, 0);
      const completed = total >= 30;
      return {
        completed,
        progress: clamp01(total / 30),
        detail: `${Math.min(total, 30)}/30 min`,
      };
    }
    case 'use_timer': {
      return {
        completed: timerStartedToday,
        progress: timerStartedToday ? 1 : 0,
        detail: timerStartedToday ? 'Started' : 'Not yet',
      };
    }
    case 'focus_60': {
      const completed = maxFocusMinutesCompletedToday >= 60;
      return {
        completed,
        progress: clamp01(maxFocusMinutesCompletedToday / 60),
        detail: `${Math.min(maxFocusMinutesCompletedToday, 60)}/60 min`,
      };
    }
    case 'match_prev_day': {
      const yesterday = yesterdayOf(today);
      const yesterdayEntries = allEntries.filter((e) => e.date === yesterday);
      const productiveYesterday = yesterdayEntries.filter((e) => e.category !== 'wasted').reduce((sum, e) => sum + e.duration, 0);
      const target = Math.max(1, productiveYesterday);
      const completed = productiveMinutesToday >= target;
      return {
        completed,
        progress: clamp01(productiveMinutesToday / target),
        detail: `${Math.min(productiveMinutesToday, target)}/${target} min`,
      };
    }
    case 'relax_10': {
      const rest = minutesForCategory(todayEntries, 'rest');
      const completed = rest >= 10;
      return {
        completed,
        progress: clamp01(rest / 10),
        detail: `${Math.min(rest, 10)}/10 min`,
      };
    }
    default: {
      return { completed: false, progress: 0, detail: '' };
    }
  }
}

function QuestRow({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: QuestStatus;
}) {
  return (
    <View style={styles.questRow}>
      <View style={styles.questRowTop}>
        <Text style={[styles.check, status.completed ? styles.checkOn : styles.checkOff]}>{status.completed ? '✓' : '○'}</Text>
        <View style={styles.questTextCol}>
          <View style={styles.questTitleRow}>
            <Text style={styles.questTitle}>{title}</Text>
            <Text style={[styles.questDetail, status.completed && styles.questDetailDone]}>{status.detail}</Text>
          </View>
          <Text style={styles.questDesc}>{description}</Text>
        </View>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(clamp01(status.progress) * 100)}%` }]} />
      </View>
    </View>
  );
}

export function DailyQuestsCard(props: Props) {
  const today = React.useMemo(() => new Date().toISOString().split('T')[0], []);
  const defs = React.useMemo(() => getDailyQuestDefinitionsForDate(today), [today]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Daily Quests</Text>
      {defs.map((q) => {
        const status = computeStatus({
          questId: q.id,
          today,
          todayEntries: props.todayEntries,
          allEntries: props.allEntries,
          streakSatisfiedToday: props.streakSatisfiedToday,
          productiveMinutesToday: props.productiveMinutesToday,
          timerStartedToday: props.timerStartedToday,
          maxFocusMinutesCompletedToday: props.maxFocusMinutesCompletedToday,
        });
        return <QuestRow key={q.id} title={q.title} description={q.description} status={status} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.secondaryText,
    fontSize: 14,
    marginBottom: 10,
  },
  questRow: {
    marginBottom: 12,
  },
  questRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  check: {
    width: 20,
    marginTop: 2,
    fontSize: 16,
    fontWeight: '900',
  },
  checkOn: {
    color: colors.green,
  },
  checkOff: {
    color: colors.secondaryText,
    opacity: 0.65,
  },
  questTextCol: {
    flex: 1,
  },
  questTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  questTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  questDetail: {
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '800',
  },
  questDetailDone: {
    color: colors.green,
  },
  questDesc: {
    marginTop: 2,
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
  },
  barTrack: {
    marginTop: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#1a2232',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
});

