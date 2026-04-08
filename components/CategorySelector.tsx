import React from 'react';
import { View, Text, Pressable, StyleSheet, PressableStateCallbackType } from 'react-native';
import { categories, CategoryType } from '../constants/categories';
import { colors } from '../constants/colors';

interface CategorySelectorProps {
  value: CategoryType;
  onChange: (value: CategoryType) => void;
}

type PressState = PressableStateCallbackType & { hovered?: boolean };

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  return (
    <View style={styles.container}>
      {categories.map((category) => {
        const selected = category.key === value;
        return (
          <Pressable
            key={category.key}
            style={({ pressed, hovered }: PressState) => [
              styles.button,
              selected && {
                backgroundColor: pressed ? colors.primaryPressed : hovered ? colors.primaryHover : colors.primary,
              },
            ]}
            onPress={() => onChange(category.key)}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{category.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  button: {
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    minWidth: '30%',
    alignItems: 'center',
  },
  label: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  labelSelected: {
    color: '#fff',
  },
});
