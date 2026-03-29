import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { TimeEntry, useTimeStore } from '../../store/useTimeStore';
import { getTotalTime, getProductiveTime, getWastedTime, getDollarValue } from '../../utils/calculations';
import { colors } from '../../constants/colors';

function getWeekEntries(entries: TimeEntry[]) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return entries.filter((entry) => {
    const entryDate = new Date(entry.date + 'T00:00:00');
    return entryDate >= weekAgo && entryDate <= now;
  });
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
  const productivePercent = total > 0 ? (productive / total) * 100 : 0;

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
});
