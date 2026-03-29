import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTimeStore } from '../../store/useTimeStore';
import { getTotalTime, getProductiveTime, getWastedTime, getDollarValue } from '../../utils/calculations';
import { colors } from '../../constants/colors';

export default function DashboardScreen() {
  // Select the function, not the result
  const getTodayEntries = useTimeStore((state) => state.getTodayEntries);

  // Call the function to get today's entries
  const todayEntries = React.useMemo(() => getTodayEntries(), [getTodayEntries]);

  const total = getTotalTime(todayEntries);
  const productive = getProductiveTime(todayEntries);
  const wasted = getWastedTime(todayEntries);
  const wastedValue = getDollarValue(wasted);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>TimeROI Dashboard</Text>

      <View style={[styles.card, styles.wastedCard]}>
        <Text style={styles.wastedText}>You wasted ${wastedValue.toFixed(2)} today</Text>
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
