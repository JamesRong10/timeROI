import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Landing / Home screen for logged-out users.
 *
 * Goals:
 * - Explain what TimeROI does in one sentence.
 * - Offer clear entry points: Log in, Create account, or Continue as guest.
 */
export default function AuthHomeScreen() {
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);

  const onContinue = async () => {
    await continueAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TimeROI</Text>

      <View style={styles.card}>
        <Text style={styles.subtitle}>
          Log your time by category and see the dollar cost of wasted minutes.
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.primaryButton, styles.actionSpacing]} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.primaryButtonText}>Log in</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.secondaryButton, styles.actionSpacing]} onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.secondaryButtonText}>Create account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostButton} onPress={onContinue}>
            <Text style={styles.ghostButtonText}>Continue without logging in</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>
        Guest mode keeps data only for this session.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subtitle: {
    color: colors.secondaryText,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18,
  },
  actions: {
    marginTop: 2,
  },
  actionSpacing: {
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#1a2232',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  ghostButton: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: colors.secondaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    marginTop: 14,
    color: colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
  },
});
