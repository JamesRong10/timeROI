import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { TimeEntry } from '../store/useTimeStore';

interface TimeBlockCardProps {
  entry: TimeEntry;
}

export function TimeBlockCard({ entry }: TimeBlockCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.category}>{entry.category.toUpperCase()}</Text>
        <Text style={styles.duration}>{entry.duration} min</Text>
      </View>
      <Text style={styles.date}>{entry.date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    padding: 14,
    marginVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  category: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  duration: {
    color: colors.yellow,
    fontWeight: '700',
  },
  date: {
    color: colors.secondaryText,
    fontSize: 12,
  },
});
