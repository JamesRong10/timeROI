import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTimeStore } from '../../store/useTimeStore';
import { getTotalTime, getProductiveTime, getWastedTime, getDollarValue } from '../../utils/calculations';
import { colors } from '../../constants/colors';

function getWeekEntries(entries: ReturnType<typeof useTimeStore>['entries']) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return entries.filter((entry) => {
    const entryDate = new Date(entry.date + 'T00:00:00');
    return entryDate >= weekAgo && entryDate <= now;
  });
}

export default function StatsScreen() {
  const entries = useTimeStore((state) => state.entries);
  const weeklyEntries = getWeekEntries(entries);

  const total = getTotalTime(weeklyEntries);
  const productive = getProductiveTime(weeklyEntries);
  const wasted = getWastedTime(weeklyEntries);
  const wastedValue = getDollarValue(wasted);
  const productivePercent = total > 0 ? (productive / total) * 100 : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Weekly Stats</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Weekly Total Time</Text>
        <Text style={styles.largeText}>{total} min</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Productive Time</Text>
        <Text style={styles.largeText}>{productive} min</Text>
        <Text style={styles.detail}>{productivePercent.toFixed(1)}% productive</Text>
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
});
