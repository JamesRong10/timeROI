import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { TimeEntry, useTimeStore } from '../../store/useTimeStore';
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
    </ScrollView>
  );
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
