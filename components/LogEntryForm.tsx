import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, PressableStateCallbackType } from 'react-native';
import { useTimeStore } from '../store/useTimeStore';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { CategorySelector } from './CategorySelector';
import { colors } from '../constants/colors';
import { CategoryType } from '../constants/categories';

type Props = {
  onAdded?: () => void;
  showSuccessAlert?: boolean;
};

type PressState = PressableStateCallbackType & { hovered?: boolean };

export function LogEntryForm({ onAdded, showSuccessAlert = true }: Props) {
  const addEntry = useTimeStore((state) => state.addEntry);
  const recordFeatureUse = usePreferencesStore((s) => s.recordFeatureUse);
  const [durationText, setDurationText] = React.useState('');
  const [category, setCategory] = React.useState<CategoryType>('money');

  React.useEffect(() => {
    void recordFeatureUse('log');
  }, [recordFeatureUse]);

  const handleAdd = () => {
    const minutes = Number(durationText);
    if (!minutes || minutes <= 0) {
      Alert.alert('Invalid duration', 'Please enter a positive number of minutes.');
      return;
    }

    const now = new Date();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      duration: minutes,
      category,
      date: now.toISOString().split('T')[0],
      created_at: now.toISOString(),
      source: 'manual' as const,
    };

    addEntry(entry);
    setDurationText('');
    if (showSuccessAlert) {
      Alert.alert('Added', `Entry added: ${minutes} min ${category}`);
    }
    onAdded?.();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Duration (minutes)</Text>
      <TextInput
        style={styles.input}
        value={durationText}
        keyboardType="numeric"
        onChangeText={setDurationText}
        placeholder="e.g. 30"
        placeholderTextColor={colors.secondaryText}
      />
      <Text style={[styles.label, { marginTop: 12 }]}>Category</Text>
      <CategorySelector value={category} onChange={setCategory} />
      <Pressable
        style={({ pressed, hovered }: PressState) => [
          styles.button,
          { backgroundColor: pressed ? colors.primaryPressed : hovered ? colors.primaryHover : colors.primary },
        ]}
        onPress={handleAdd}
      >
        <Text style={styles.buttonText}>Add Entry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.secondaryText,
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a2232',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
