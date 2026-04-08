import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { colors } from '../constants/colors';
import { LogEntryForm } from './LogEntryForm';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function LogEntryModal({ visible, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.centerWrap}
        >
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Log Entry</Text>
              <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <LogEntryForm onAdded={onClose} showSuccessAlert={false} />
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a2232',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: -2,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  bodyContent: {
    paddingTop: 14,
    paddingBottom: 4,
  },
});

