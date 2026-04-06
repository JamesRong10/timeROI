import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useTimeStore } from '../../store/useTimeStore';
import { useStreakStore } from '../../store/useStreakStore';
import { getTotalTime, getProductiveTime, getWastedTime, getDollarValue } from '../../utils/calculations';
import { colors } from '../../constants/colors';

/**
 * Dashboard tab.
 *
 * Shows:
 * - Dollar value of wasted time today
 * - Current streak status
 * - A simple focus timer (no audio)
 * - Today's totals by category
 */
function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

export default function DashboardScreen() {
  // Select the function, not the result
  const getTodayEntries = useTimeStore((state) => state.getTodayEntries);
  const streak = useStreakStore((s) => s.current);
  const lastActiveDate = useStreakStore((s) => s.lastActiveDate);

  // Call the function to get today's entries
  const todayEntries = React.useMemo(() => getTodayEntries(), [getTodayEntries]);

  const total = getTotalTime(todayEntries);
  const productive = getProductiveTime(todayEntries);
  const wasted = getWastedTime(todayEntries);
  const wastedValue = getDollarValue(wasted);

  const today = React.useMemo(() => new Date().toISOString().split('T')[0], []);
  const streakSatisfiedToday = lastActiveDate === today;
  const flame = streakSatisfiedToday ? '🔥' : '🔥︎'; // VS15 requests text (often B/W) presentation where supported

  const presetMinutes = React.useMemo(() => [5, 10, 15, 25, 50], []);
  const [selectedMinutes, setSelectedMinutes] = React.useState<number>(25);
  const [customMinutesText, setCustomMinutesText] = React.useState('');
  const [durationSeconds, setDurationSeconds] = React.useState(selectedMinutes * 60);
  const [remainingSeconds, setRemainingSeconds] = React.useState(selectedMinutes * 60);
  const [timerState, setTimerState] = React.useState<'idle' | 'running' | 'paused' | 'done'>('idle');
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Apply a preset selection (also resets the timer).
  const applySelection = React.useCallback((minutes: number) => {
    const seconds = Math.max(1, Math.floor(minutes * 60));
    setSelectedMinutes(minutes);
    setCustomMinutesText('');
    setDurationSeconds(seconds);
    setRemainingSeconds(seconds);
    setTimerState('idle');
  }, []);

  // Apply a custom minutes input (clamped to 1..180 minutes).
  const applyCustom = React.useCallback(() => {
    const parsed = Number(customMinutesText);
    if (!Number.isFinite(parsed)) return;
    const minutes = Math.max(1, Math.min(180, Math.floor(parsed)));
    const seconds = minutes * 60;
    setSelectedMinutes(minutes);
    setDurationSeconds(seconds);
    setRemainingSeconds(seconds);
    setTimerState('idle');
  }, [customMinutesText]);

  // Clears the active interval if present.
  const stopInterval = React.useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Run the countdown while the timer is in "running" state.
  React.useEffect(() => {
    if (timerState !== 'running') {
      stopInterval();
      return;
    }

    stopInterval();
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => stopInterval();
  }, [timerState, stopInterval]);

  // When the timer hits zero, mark it done and stop the interval.
  React.useEffect(() => {
    if (timerState === 'running' && remainingSeconds <= 0) {
      stopInterval();
      setTimerState('done');
    }
  }, [remainingSeconds, timerState, stopInterval]);

  React.useEffect(() => {
    return () => stopInterval();
  }, [stopInterval]);

  // Starts (or resumes) the countdown.
  const onStart = React.useCallback(() => {
    if (remainingSeconds <= 0) {
      setRemainingSeconds(durationSeconds);
    }
    setTimerState('running');
  }, [remainingSeconds, durationSeconds]);

  // Pauses the countdown.
  const onPause = React.useCallback(() => setTimerState('paused'), []);

  // Resets the countdown to the selected duration.
  const onReset = React.useCallback(() => {
    stopInterval();
    setRemainingSeconds(durationSeconds);
    setTimerState('idle');
  }, [durationSeconds, stopInterval]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>TimeROI Dashboard</Text>

      <View style={[styles.card, styles.wastedCard]}>
        <Text style={styles.wastedText}>You wasted ${wastedValue.toFixed(2)} today</Text>
      </View>

      <View style={[styles.card, styles.streakCard]}>
        <Text style={styles.cardTitle}>Current Streak</Text>
        <Text style={styles.streakValue}>
          {streak} day{streak === 1 ? '' : 's'}
        </Text>
        <Text style={[styles.streakEmoji, !streakSatisfiedToday && styles.streakEmojiMuted]}>{flame}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Focus Timer</Text>

        <View style={styles.pillsRow}>
          {presetMinutes.map((m) => {
            const active = selectedMinutes === m && customMinutesText.length === 0;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}
                onPress={() => applySelection(m)}
              >
                <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>{m}m</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            value={customMinutesText}
            onChangeText={setCustomMinutesText}
            keyboardType="numeric"
            placeholder="Custom minutes"
            placeholderTextColor={colors.secondaryText}
          />
          <TouchableOpacity style={styles.customApply} onPress={applyCustom}>
            <Text style={styles.customApplyText}>Set</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.timerCenter}>
          <Text style={styles.timerText}>{formatMMSS(remainingSeconds)}</Text>
          <Text style={styles.timerHint}>
            {timerState === 'done'
              ? 'Done. Great work.'
              : timerState === 'running'
                ? 'Stay focused until it hits 0.'
                : 'Pick a duration and start.'}
          </Text>
        </View>

        <View style={styles.timerButtonsRow}>
          {timerState === 'running' ? (
            <TouchableOpacity style={[styles.timerButton, styles.timerButtonSecondary, styles.timerButtonLeft]} onPress={onPause}>
              <Text style={styles.timerButtonText}>Pause</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.timerButton, styles.timerButtonPrimary, styles.timerButtonLeft]} onPress={onStart}>
              <Text style={styles.timerButtonText}>{timerState === 'paused' ? 'Resume' : 'Start'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.timerButton, styles.timerButtonSecondary, styles.timerButtonRight]} onPress={onReset}>
            <Text style={styles.timerButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Total Time Today</Text>
        <Text style={styles.largeText}>{total} min</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Productive</Text>
          <Text style={styles.value}>{productive} min</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.cardTitle}>Wasted</Text>
          <Text style={[styles.value, { color: colors.danger }]}>{wasted} min</Text>
        </View>
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
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wastedCard: {
    borderColor: colors.danger,
  },
  wastedText: {
    color: colors.danger,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  cardTitle: {
    color: colors.secondaryText,
    fontSize: 14,
    marginBottom: 4,
  },
  largeText: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  streakCard: {
    alignSelf: 'flex-start',
    width: '62%',
    paddingVertical: 12,
  },
  streakEmoji: {
    fontSize: 18,
    marginTop: 4,
  },
  streakEmojiMuted: {
    opacity: 0.35,
  },
  streakValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillInactive: {
    backgroundColor: '#1a2232',
    borderColor: colors.border,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  pillTextActive: {
    color: '#fff',
  },
  pillTextInactive: {
    color: colors.secondaryText,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  customInput: {
    flex: 1,
    backgroundColor: '#1a2232',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  customApply: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1a2232',
  },
  customApplyText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  timerCenter: {
    marginTop: 14,
    alignItems: 'center',
  },
  timerText: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
  },
  timerHint: {
    marginTop: 6,
    color: colors.secondaryText,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  timerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  timerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  timerButtonLeft: {
    marginRight: 8,
  },
  timerButtonRight: {
    marginLeft: 8,
  },
  timerButtonPrimary: {
    backgroundColor: colors.primary,
  },
  timerButtonSecondary: {
    backgroundColor: '#1a2232',
    borderWidth: 1,
    borderColor: colors.border,
  },
  timerButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  value: {
    color: colors.green,
    fontSize: 16,
    fontWeight: '700',
  },
});
