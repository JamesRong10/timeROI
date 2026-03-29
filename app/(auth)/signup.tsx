import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { colors } from '../../constants/colors';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Sign up screen.
 *
 * Inputs:
 * - Email
 * - Password
 * - Verify password (typed twice)
 *
 * Behavior:
 * - Calls `useAuthStore().signUp(...)` and navigates to tabs on success.
 */
export default function SignupScreen() {
  const signUp = useAuthStore((s) => s.signUp);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Attempts to create an account and redirect to the main app.
  const onSubmit = async () => {
    try {
      setSubmitting(true);
      await signUp(email, password, confirmPassword);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Sign up failed', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    // Clear stale errors when leaving the screen.
    return () => clearError();
  }, [clearError]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.secondaryText}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 6 characters"
          placeholderTextColor={colors.secondaryText}
        />

        <Text style={[styles.label, { marginTop: 12 }]}>Verify password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="Type password again"
          placeholderTextColor={colors.secondaryText}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.button, submitting && styles.buttonDisabled]} onPress={onSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Creating…' : 'Create account'}</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Already have an account?{' '}
          <Link href="/(auth)/login" style={styles.link}>
            Sign in
          </Link>
        </Text>
      </View>
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
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
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
  error: {
    color: colors.danger,
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  footerText: {
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 14,
    fontSize: 14,
  },
  link: {
    color: colors.text,
    fontWeight: '800',
  },
});
