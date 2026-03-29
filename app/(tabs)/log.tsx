import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useTimeStore } from '../../store/useTimeStore';
import { CategorySelector } from '../../components/CategorySelector';
import { colors } from '../../constants/colors';
import { CategoryType } from '../../constants/categories';

export default function LogScreen() {
  const addEntry = useTimeStore((state) => state.addEntry);
  const [durationText, setDurationText] = useState('');
  const [category, setCategory] = useState<CategoryType>('money');

  const handleAdd = () => {
    const minutes = Number(durationText);
    if (!minutes || minutes <= 0) {
      Alert.alert('Invalid duration', 'Please enter a positive number of minutes.');
      return;
    }

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      duration: minutes,
      category,
      date: new Date().toISOString().split('T')[0],
    };

    addEntry(entry);
    setDurationText('');
    Alert.alert('Added', `Entry added: ${minutes} min ${category}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Log Time Entry</Text>
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
        <TouchableOpacity style={styles.button} onPress={handleAdd}>
          <Text style={styles.buttonText}>Add Entry</Text>
        </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
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
    backgroundColor: colors.primary,
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
