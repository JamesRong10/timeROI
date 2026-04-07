import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Modal, Pressable } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { TimeEntry, useTimeStore } from '../../store/useTimeStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useStreakStore } from '../../store/useStreakStore';
import { getTotalTime, getProductiveTime, getWastedTime, getDollarValue } from '../../utils/calculations';
import { colors } from '../../constants/colors';

/**
 * Weekly stats tab.
 *
 * Includes:
 * - "Insights" ring charts (outer-ring only, no filled pie):
 *   1) Productive vs non-productive (weekly)
 *   2) "Money lost" percent (weekly wasted / weekly total)
 *   3) Improvement from yesterday (productive% today - productive% yesterday)
 * - Weekly totals and wasted dollar value
 */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayString(dateString: string): string {
  const d = new Date(`${dateString}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getWeekEntries(entries: TimeEntry[]) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return entries.filter((entry) => {
    const entryDate = new Date(entry.date + 'T00:00:00');
    return entryDate >= weekAgo && entryDate <= now;
  });
}

function getEntriesForDate(entries: TimeEntry[], date: string): TimeEntry[] {
  return entries.filter((e) => e.date === date);
}

function isWorkCategory(entry: TimeEntry): boolean {
  // Treat "rest" and "wasted" as non-work for work-focused badges.
  return entry.category !== 'wasted' && entry.category !== 'rest';
}

function entryTimestamp(entry: TimeEntry): string | null {
  return entry.started_at ?? entry.created_at ?? null;
}

function entryHourLocal(entry: TimeEntry): number | null {
  const ts = entryTimestamp(entry);
  if (!ts) return null;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).getHours();
}

function sumMinutes(entries: TimeEntry[], predicate: (e: TimeEntry) => boolean): number {
  return entries.filter(predicate).reduce((sum, e) => sum + e.duration, 0);
}

function groupByDate(entries: TimeEntry[]): Record<string, TimeEntry[]> {
  return entries.reduce<Record<string, TimeEntry[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});
}

function getRollingWindow(entries: TimeEntry[], endMs: number, windowDays: number): TimeEntry[] {
  const startMs = endMs - windowDays * 24 * 60 * 60 * 1000;
  return entries.filter((e) => {
    const d = Date.parse(`${e.date}T00:00:00`);
    return Number.isFinite(d) && d >= startMs && d <= endMs;
  });
}

type BadgeShape = 'circle' | 'square' | 'diamond' | 'triangle';

type BadgeDefinition = {
  id: string;
  title: string;
  group:
    | 'Consistency & Streaks'
    | 'Productivity & Focus'
    | 'Efficiency & ROI'
    | 'Goal Achievement'
    | 'Exploration & Engagement'
    | 'Bonus / Fun';
  requirement: string;
  shape: BadgeShape;
  color: string;
  status: 'live' | 'coming_soon';
};

const BADGE_UNLOCKED_AT_KEY = 'badges:unlocked_at';

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

function compareIsoDesc(a: string, b: string): number {
  const am = Date.parse(a);
  const bm = Date.parse(b);
  if (!Number.isFinite(am) && !Number.isFinite(bm)) return 0;
  if (!Number.isFinite(am)) return 1;
  if (!Number.isFinite(bm)) return -1;
  return bm - am;
}

type RingProps = {
  label: string;
  valueText: string;
  progress: number; // 0..1
  color: string;
};

function Ring({ label, valueText, progress, color }: RingProps) {
  const size = 84;
  const thickness = 10;
  const half = size / 2;

  // Progress is represented by a rotating half-circle trick (no extra libraries).
  const p = clamp01(progress);
  const rightRotate = p <= 0.5 ? p * 360 - 180 : 0;
  const leftRotate = p > 0.5 ? (p - 0.5) * 360 - 180 : -180;

  return (
    <View style={styles.ringBox}>
      <View style={[styles.ringOuter, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.ringProgressLayer, { width: size, height: size, borderRadius: size / 2 }]}>
          <View style={[styles.halfWrapRight, { width: half, height: size }]}>
            <View
              style={[
                styles.fullCircle,
                {
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: color,
                  left: -half,
                  transform: [{ rotateZ: `${rightRotate}deg` }],
                },
              ]}
            />
          </View>

          {p > 0.5 && (
            <View style={[styles.halfWrapLeft, { width: half, height: size }]}>
              <View
                style={[
                  styles.fullCircle,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    right: -half,
                    transform: [{ rotateZ: `${leftRotate}deg` }],
                  },
                ]}
              />
            </View>
          )}
        </View>

        <View
          style={[
            styles.ringInner,
            {
              width: size - thickness * 2,
              height: size - thickness * 2,
              borderRadius: (size - thickness * 2) / 2,
            },
          ]}
        >
          <Text style={styles.ringValue}>{valueText}</Text>
        </View>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const entries = useTimeStore((state) => state.entries);
  const signOut = useAuthStore((s) => s.signOut);
  const guest = useAuthStore((s) => s.guest);
  const streak = useStreakStore((s) => s.current);

  const prefsReady = usePreferencesStore((s) => s.ready);
  const statsViewCountRaw = usePreferencesStore((s) => s.values['stats:view_count']);
  const featureUsageRaw = usePreferencesStore((s) => s.values['usage:features']);
  const badgeUnlockedAtRaw = usePreferencesStore((s) => s.values[BADGE_UNLOCKED_AT_KEY]);
  const incrementPreferenceNumber = usePreferencesStore((s) => s.incrementPreferenceNumber);
  const recordFeatureUse = usePreferencesStore((s) => s.recordFeatureUse);
  const mergeJsonObjectPreference = usePreferencesStore((s) => s.mergeJsonObjectPreference);

  const [badgesOpen, setBadgesOpen] = React.useState(false);

  React.useEffect(() => {
    void recordFeatureUse('stats');
    void incrementPreferenceNumber('stats:view_count', 1);
  }, [recordFeatureUse, incrementPreferenceNumber]);

  const weeklyEntries = getWeekEntries(entries);

  const total = getTotalTime(weeklyEntries);
  const productive = getProductiveTime(weeklyEntries);
  const wasted = getWastedTime(weeklyEntries);
  const wastedValue = getDollarValue(wasted);
  const weeklyProductiveProgress = total > 0 ? productive / total : 0;
  const weeklyMoneyLostProgress = total > 0 ? wasted / total : 0;

  const today = todayString();
  const yesterday = yesterdayString(today);
  const todayEntries = getEntriesForDate(entries, today);
  const yesterdayEntries = getEntriesForDate(entries, yesterday);

  const todayTotal = getTotalTime(todayEntries);
  const todayProductive = getProductiveTime(todayEntries);
  const todayProductivePercent = todayTotal > 0 ? (todayProductive / todayTotal) * 100 : 0;

  const yesterdayTotal = getTotalTime(yesterdayEntries);
  const yesterdayProductive = getProductiveTime(yesterdayEntries);
  const yesterdayProductivePercent = yesterdayTotal > 0 ? (yesterdayProductive / yesterdayTotal) * 100 : 0;

  const improvementPoints = Math.max(0, todayProductivePercent - yesterdayProductivePercent);
  const improvementProgress = clamp01(improvementPoints / 100);

  const statsViewCount = React.useMemo(() => {
    const n = statsViewCountRaw ? Number.parseInt(statsViewCountRaw, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  }, [statsViewCountRaw]);

  const usedFeatures = React.useMemo(() => {
    if (!featureUsageRaw) return [];
    try {
      const parsed = JSON.parse(featureUsageRaw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }, [featureUsageRaw]);

  const explorerProgress = React.useMemo(() => {
    const needed = ['dashboard', 'log', 'stats', 'settings'];
    const set = new Set(usedFeatures);
    const have = needed.filter((x) => set.has(x)).length;
    return { have, total: needed.length };
  }, [usedFeatures]);

  const badgeSignals = React.useMemo(() => {
    const hours = entries.map(entryHourLocal).filter((h): h is number => typeof h === 'number');
    const earlyBird = hours.some((h) => h >= 5 && h < 10);
    const nightOwl = hours.some((h) => h >= 22 || h < 3);

    const deepDiver = entries.some((e) => isWorkCategory(e) && e.duration >= 90);
    const quickWin = entries.some((e) => isWorkCategory(e) && e.duration > 0 && e.duration < 30);
    const focusSprint = entries.some((e) => isWorkCategory(e) && e.duration >= 25 && e.duration <= 50 && e.interruptions === 0);
    const distractionFree = entries.some((e) => isWorkCategory(e) && e.duration > 0 && e.interruptions === 0);

    const byDate = groupByDate(entries);
    const maxWorkDay = Object.values(byDate).reduce((max, dayEntries) => {
      const workMinutes = sumMinutes(dayEntries, (e) => isWorkCategory(e));
      return Math.max(max, workMinutes);
    }, 0);
    const flowMaster = maxWorkDay >= 240;

    const now = Date.now();
    const last7 = getRollingWindow(entries, now, 7);
    const prev7 = getRollingWindow(entries, now - 7 * 24 * 60 * 60 * 1000, 7);
    const wastedLast7 = sumMinutes(last7, (e) => e.category === 'wasted');
    const wastedPrev7 = sumMinutes(prev7, (e) => e.category === 'wasted');
    const timeAlchemist = wastedPrev7 > 0 && wastedLast7 <= wastedPrev7 * 0.5;

    const streak7 = streak >= 7;
    const streak30 = streak >= 30;
    const statistician = statsViewCount >= 10;

    return {
      earlyBird,
      nightOwl,
      streak7,
      streak30,
      deepDiver,
      focusSprint,
      flowMaster,
      distractionFree,
      quickWin,
      timeAlchemist,
      statistician,
      explorerProgress,
    };
  }, [entries, streak, statsViewCount, explorerProgress]);

  const badgeDefs = React.useMemo<BadgeDefinition[]>(() => {
    return [
      {
        id: 'early_bird',
        title: 'Early Bird',
        group: 'Consistency & Streaks',
        requirement: 'Track activity first thing in the morning (5am–10am local time).',
        shape: 'circle',
        color: colors.yellow,
        status: 'live',
      },
      {
        id: 'night_owl',
        title: 'Night Owl',
        group: 'Consistency & Streaks',
        requirement: 'Track late-night productivity (10pm–3am local time).',
        shape: 'diamond',
        color: '#8b5cf6',
        status: 'live',
      },
      {
        id: 'streak_7',
        title: '7-Day Streak',
        group: 'Consistency & Streaks',
        requirement: 'Use the app every day for a week.',
        shape: 'square',
        color: colors.primary,
        status: 'live',
      },
      {
        id: 'streak_30',
        title: '30-Day Streak',
        group: 'Consistency & Streaks',
        requirement: 'A full month of consistent tracking.',
        shape: 'square',
        color: '#22c55e',
        status: 'live',
      },
      {
        id: 'habit_builder',
        title: 'Habit Builder',
        group: 'Consistency & Streaks',
        requirement: 'Hit the same goal for 21 consecutive days.',
        shape: 'triangle',
        color: '#14b8a6',
        status: 'coming_soon',
      },

      {
        id: 'deep_diver',
        title: 'Deep Diver',
        group: 'Productivity & Focus',
        requirement: 'Complete a session of 90+ minutes of focused work.',
        shape: 'circle',
        color: '#06b6d4',
        status: 'live',
      },
      {
        id: 'focus_sprint',
        title: 'Focus Sprint',
        group: 'Productivity & Focus',
        requirement: 'Achieve a 25–50 minute Pomodoro session without distractions.',
        shape: 'triangle',
        color: '#f97316',
        status: 'coming_soon',
      },
      {
        id: 'flow_master',
        title: 'Flow Master',
        group: 'Productivity & Focus',
        requirement: 'Hit 4+ hours of productive work in a single day.',
        shape: 'diamond',
        color: '#60a5fa',
        status: 'live',
      },
      {
        id: 'distraction_free',
        title: 'Distraction-Free',
        group: 'Productivity & Focus',
        requirement: 'Complete a session with zero interruptions.',
        shape: 'circle',
        color: '#a855f7',
        status: 'coming_soon',
      },

      {
        id: 'quick_win',
        title: 'Quick Win',
        group: 'Efficiency & ROI',
        requirement: 'Complete a task under 30 minutes.',
        shape: 'square',
        color: '#f59e0b',
        status: 'live',
      },
      {
        id: 'big_impact',
        title: 'Big Impact',
        group: 'Efficiency & ROI',
        requirement: 'Complete a task with a high timeROI score.',
        shape: 'diamond',
        color: '#ef4444',
        status: 'coming_soon',
      },
      {
        id: 'multiplier',
        title: 'Multiplier',
        group: 'Efficiency & ROI',
        requirement: 'Turn 1 hour of planning into 2+ hours of effective output.',
        shape: 'triangle',
        color: '#10b981',
        status: 'coming_soon',
      },
      {
        id: 'time_alchemist',
        title: 'Time Alchemist',
        group: 'Efficiency & ROI',
        requirement: 'Reduce wasted time by 50% in a week.',
        shape: 'circle',
        color: '#e11d48',
        status: 'live',
      },

      {
        id: 'goal_getter',
        title: 'Goal Getter',
        group: 'Goal Achievement',
        requirement: 'Finish all daily goals.',
        shape: 'square',
        color: '#22c55e',
        status: 'coming_soon',
      },
      {
        id: 'project_finisher',
        title: 'Project Finisher',
        group: 'Goal Achievement',
        requirement: 'Complete a long-term project tracked in the app.',
        shape: 'diamond',
        color: '#38bdf8',
        status: 'coming_soon',
      },
      {
        id: 'milestone_maker',
        title: 'Milestone Maker',
        group: 'Goal Achievement',
        requirement: 'Hit a weekly or monthly target consistently.',
        shape: 'triangle',
        color: '#a3e635',
        status: 'coming_soon',
      },

      {
        id: 'explorer',
        title: 'Explorer',
        group: 'Exploration & Engagement',
        requirement: 'Try all app features (tracking, stats, reminders).',
        shape: 'diamond',
        color: '#f472b6',
        status: 'live',
      },
      {
        id: 'statistician',
        title: 'Statistician',
        group: 'Exploration & Engagement',
        requirement: 'Check your detailed analytics 10+ times.',
        shape: 'circle',
        color: '#fb7185',
        status: 'live',
      },
      {
        id: 'customizer',
        title: 'Customizer',
        group: 'Exploration & Engagement',
        requirement: 'Set up personalized goals, categories, and alerts.',
        shape: 'square',
        color: '#34d399',
        status: 'coming_soon',
      },

      {
        id: 'time_ninja',
        title: 'Time Ninja',
        group: 'Bonus / Fun',
        requirement: 'Master time tracking so efficiently, it feels invisible.',
        shape: 'triangle',
        color: '#94a3b8',
        status: 'coming_soon',
      },
    ];
  }, []);

  const isUnlocked = React.useCallback(
    (badgeId: string) => {
      switch (badgeId) {
        case 'early_bird':
          return badgeSignals.earlyBird;
        case 'night_owl':
          return badgeSignals.nightOwl;
        case 'streak_7':
          return badgeSignals.streak7;
        case 'streak_30':
          return badgeSignals.streak30;
        case 'deep_diver':
          return badgeSignals.deepDiver;
        case 'flow_master':
          return badgeSignals.flowMaster;
        case 'quick_win':
          return badgeSignals.quickWin;
        case 'time_alchemist':
          return badgeSignals.timeAlchemist;
        case 'explorer':
          return badgeSignals.explorerProgress.have === badgeSignals.explorerProgress.total;
        case 'statistician':
          return badgeSignals.statistician;
        default:
          return false;
      }
    },
    [badgeSignals],
  );

  const unlockedAtMap = React.useMemo(() => safeParseStringMap(badgeUnlockedAtRaw), [badgeUnlockedAtRaw]);

  React.useEffect(() => {
    if (!prefsReady) return;
    if (guest) return;
    const nowIso = new Date().toISOString();
    const patch: Record<string, string> = {};
    for (const def of badgeDefs) {
      if (def.status !== 'live') continue;
      if (!isUnlocked(def.id)) continue;
      if (!unlockedAtMap[def.id]) patch[def.id] = nowIso;
    }
    if (Object.keys(patch).length === 0) return;
    void mergeJsonObjectPreference(BADGE_UNLOCKED_AT_KEY, patch);
  }, [prefsReady, guest, badgeDefs, isUnlocked, unlockedAtMap, mergeJsonObjectPreference]);

  const recentUnlocked = React.useMemo(() => {
    const unlocked = badgeDefs
      .filter((b) => b.status === 'live' && isUnlocked(b.id))
      .map((b) => ({ ...b, unlockedAt: unlockedAtMap[b.id] ?? '' }))
      .sort((a, b) => compareIsoDesc(a.unlockedAt, b.unlockedAt));
    return unlocked.slice(0, 3);
  }, [badgeDefs, isUnlocked, unlockedAtMap]);

  const onLogout = async () => {
    try {
      await signOut();
    } catch (e: any) {
      Alert.alert('Logout failed', e?.message ?? 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Stats</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>{guest ? 'Exit' : 'Log out'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Insights</Text>
        <View style={styles.ringsRow}>
          <Ring
            label="Productive"
            valueText={`${Math.round(weeklyProductiveProgress * 100)}%`}
            progress={weeklyProductiveProgress}
            color={colors.success}
          />
          <Ring
            label="Money Lost"
            valueText={`${Math.round(weeklyMoneyLostProgress * 100)}%`}
            progress={weeklyMoneyLostProgress}
            color={colors.danger}
          />
          <Ring
            label="Improved"
            valueText={`+${improvementPoints.toFixed(0)}%`}
            progress={improvementProgress}
            color={colors.yellow}
          />
        </View>
        <Text style={styles.detail}>
          Improvement compares today ({today}) vs yesterday ({yesterday}) productive %.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Total Time</Text>
        <Text style={styles.largeText}>{total} min</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Productive Time</Text>
        <Text style={styles.largeText}>{productive} min</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Wasted Time</Text>
        <Text style={styles.largeText}>{wasted} min</Text>
        <Text style={styles.detail}>Value lost: ${wastedValue.toFixed(2)}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.badgesHeaderRow}>
          <Text style={styles.cardTitle}>Badges</Text>
          <TouchableOpacity style={styles.badgesCta} onPress={() => setBadgesOpen(true)}>
            <Text style={styles.badgesCtaText}>View all</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.detail}>Most recent unlocks</Text>

        {guest ? (
          <Text style={styles.detail}>Badges are saved for logged-in users.</Text>
        ) : recentUnlocked.length === 0 ? (
          <Text style={styles.detail}>No badges unlocked yet. Log some time to start earning them.</Text>
        ) : (
          <View style={styles.recentRow}>
            {recentUnlocked.map((b) => (
              <View key={b.id} style={styles.recentBadge}>
                <View style={styles.iconWrap}>
                  <View style={shapeStyle(b.shape, b.color)} />
                </View>
                <Text style={styles.recentTitle} numberOfLines={2}>
                  {b.title}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal visible={badgesOpen} transparent animationType="fade" onRequestClose={() => setBadgesOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBadgesOpen(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>All badges</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setBadgesOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            {(
              [
                'Consistency & Streaks',
                'Productivity & Focus',
                'Efficiency & ROI',
                'Goal Achievement',
                'Exploration & Engagement',
                'Bonus / Fun',
              ] as const
            ).map((group) => {
              const items = badgeDefs.filter((b) => b.group === group);
              if (items.length === 0) return null;
              return (
                <View key={group} style={{ marginBottom: 14 }}>
                  <Text style={styles.groupTitle}>{group}</Text>
                  {items.map((b) => {
                    const unlocked = b.status === 'live' && isUnlocked(b.id);
                    const statusText = b.status === 'coming_soon' ? 'Coming soon' : unlocked ? 'Unlocked' : 'Locked';
                    const statusStyle =
                      b.status === 'coming_soon' ? styles.badgeSoon : unlocked ? styles.badgeOn : styles.badgeOff;
                    return (
                      <View key={b.id} style={styles.badgeItem}>
                        <View style={styles.badgeIcon}>
                          <View style={shapeStyle(b.shape, b.color)} />
                        </View>
                        <View style={styles.badgeText}>
                          <View style={styles.badgeTitleRow}>
                            <Text style={styles.badgeName}>{b.title}</Text>
                            <Text style={[styles.badgeStatus, statusStyle]}>{statusText}</Text>
                          </View>
                          <Text style={styles.badgeRequirement}>{b.requirement}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

function shapeStyle(shape: BadgeShape, color: string) {
  switch (shape) {
    case 'circle':
      return { width: 26, height: 26, borderRadius: 13, backgroundColor: color };
    case 'square':
      return { width: 26, height: 26, borderRadius: 6, backgroundColor: color };
    case 'diamond':
      return { width: 20, height: 20, backgroundColor: color, transform: [{ rotateZ: '45deg' }] };
    case 'triangle':
      return {
        width: 0,
        height: 0,
        borderLeftWidth: 13,
        borderRightWidth: 13,
        borderBottomWidth: 24,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    position: 'relative',
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  logoutButton: {
    position: 'absolute',
    right: 0,
    top: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1a2232',
  },
  logoutText: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '800',
  },
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
    marginBottom: 8,
  },
  largeText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  detail: {
    color: colors.secondaryText,
    fontSize: 14,
    marginTop: 8,
  },
  badgesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgesCta: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1a2232',
  },
  badgesCtaText: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '900',
  },
  recentRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  recentBadge: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1a2232',
    padding: 12,
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 70,
    bottom: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  modalHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  modalClose: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1a2232',
  },
  modalCloseText: {
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '900',
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: 14,
    paddingBottom: 22,
  },
  groupTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 10,
  },
  badgeItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    flex: 1,
  },
  badgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  badgeName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    flex: 1,
  },
  badgeStatus: {
    fontSize: 12,
    fontWeight: '900',
  },
  badgeRequirement: {
    marginTop: 6,
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  badgeOn: { color: colors.success },
  badgeOff: { color: colors.secondaryText },
  badgeSoon: { color: colors.yellow },
  ringsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  ringBox: {
    width: '32%',
    alignItems: 'center',
  },
  ringOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a2232',
  },
  ringProgressLayer: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ rotateZ: '-90deg' }],
  },
  halfWrapRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    overflow: 'hidden',
  },
  halfWrapLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  fullCircle: {
    position: 'absolute',
    top: 0,
  },
  ringInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  ringValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  ringLabel: {
    marginTop: 8,
    color: colors.secondaryText,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
