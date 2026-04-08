import React from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, Alert, Pressable, PressableStateCallbackType } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { colors } from '../../constants/colors';

const AUTO_LOGOUT_PREF_KEY = 'auth:auto_logout_policy';

type AutoLogoutOption = {
  value: '1d' | '3d' | '1w' | '1m' | 'on_clear';
  title: string;
  subtitle: string;
};

const autoLogoutOptions: AutoLogoutOption[] = [
  { value: '1d', title: 'Every day', subtitle: 'Log out after 24 hours.' },
  { value: '3d', title: 'Every 3 days', subtitle: 'Log out after 72 hours.' },
  { value: '1w', title: 'Every week', subtitle: 'Default. Log out after 7 days.' },
  { value: '1m', title: 'Every month', subtitle: 'Log out after ~30 days.' },
  { value: 'on_clear', title: 'Only when cache is cleared', subtitle: 'No timed logout; session ends when storage is cleared.' },
];

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const guest = useAuthStore((s) => s.guest);
  const signOut = useAuthStore((s) => s.signOut);
  const updateEmail = useAuthStore((s) => s.updateEmail);
  const changePassword = useAuthStore((s) => s.changePassword);

  const prefsReady = usePreferencesStore((s) => s.ready);
  const policyPref = usePreferencesStore((s) => s.values[AUTO_LOGOUT_PREF_KEY]);
  const setPreference = usePreferencesStore((s) => s.setPreference);
  const recordFeatureUse = usePreferencesStore((s) => s.recordFeatureUse);

  const [email, setEmail] = React.useState(user?.email ?? '');
  const [emailPassword, setEmailPassword] = React.useState('');
  const [emailSubmitting, setEmailSubmitting] = React.useState(false);

  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [passwordSubmitting, setPasswordSubmitting] = React.useState(false);

  const selectedPolicy = (policyPref as AutoLogoutOption['value'] | undefined) ?? '1w';

  React.useEffect(() => {
    setEmail(user?.email ?? '');
  }, [user?.email]);

  React.useEffect(() => {
    void recordFeatureUse('settings');
  }, [recordFeatureUse]);

  const onLogout = async () => {
    try {
      await signOut();
    } catch (e: any) {
      Alert.alert('Logout failed', e?.message ?? 'Please try again.');
    }
  };

  const onUpdateEmail = async () => {
    try {
      if (!user) return;
      setEmailSubmitting(true);
      await updateEmail(email, emailPassword);
      setEmailPassword('');
      Alert.alert('Email updated', 'Your email has been updated.');
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Please try again.');
    } finally {
      setEmailSubmitting(false);
    }
  };

  const onChangePassword = async () => {
    try {
      if (!user) return;
      setPasswordSubmitting(true);
      await changePassword(oldPassword, newPassword, confirmNewPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Please try again.');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const onSelectPolicy = async (value: AutoLogoutOption['value']) => {
    try {
      if (!user) return;
      await setPreference(AUTO_LOGOUT_PREF_KEY, value);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>{guest ? 'Exit' : 'Log out'}</Text>
        </TouchableOpacity>
      </View>

      {guest ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Guest mode</Text>
          <Text style={styles.detail}>
            Guest mode keeps data only for this session. Create an account to sync preferences like automatic logout.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>

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

            <Text style={[styles.label, { marginTop: 12 }]}>Current password</Text>
            <TextInput
              style={styles.input}
              value={emailPassword}
              onChangeText={setEmailPassword}
              secureTextEntry
              placeholder="Required to change email"
              placeholderTextColor={colors.secondaryText}
            />

            <Pressable
              style={({ pressed, hovered }: PressableStateCallbackType & { hovered?: boolean }) => [
                styles.button,
                emailSubmitting && styles.buttonDisabled,
                { backgroundColor: pressed ? colors.primaryPressed : hovered ? colors.primaryHover : colors.primary },
              ]}
              onPress={onUpdateEmail}
              disabled={emailSubmitting}
            >
              <Text style={styles.buttonText}>{emailSubmitting ? 'Updating…' : 'Update email'}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Change password</Text>

            <Text style={styles.label}>Current password</Text>
            <TextInput
              style={styles.input}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry
              placeholder="Current password"
              placeholderTextColor={colors.secondaryText}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>New password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor={colors.secondaryText}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Verify new password</Text>
            <TextInput
              style={styles.input}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
              placeholder="Type new password again"
              placeholderTextColor={colors.secondaryText}
            />

            <Pressable
              style={({ pressed, hovered }: PressableStateCallbackType & { hovered?: boolean }) => [
                styles.button,
                passwordSubmitting && styles.buttonDisabled,
                { backgroundColor: pressed ? colors.primaryPressed : hovered ? colors.primaryHover : colors.primary },
              ]}
              onPress={onChangePassword}
              disabled={passwordSubmitting}
            >
              <Text style={styles.buttonText}>{passwordSubmitting ? 'Updating…' : 'Update password'}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Automatic logout</Text>
            <Text style={styles.detail}>
              Choose how often to automatically log out. This is enforced when the app starts and whenever it returns to the
              foreground.
            </Text>

            {!prefsReady ? (
              <Text style={[styles.detail, { marginTop: 10 }]}>Loading preferences…</Text>
            ) : (
              <View style={{ marginTop: 10 }}>
                {autoLogoutOptions.map((opt) => {
                  const active = selectedPolicy === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.optionRow, active ? styles.optionRowActive : styles.optionRowInactive]}
                      onPress={() => onSelectPolicy(opt.value)}
                    >
                      <View style={styles.optionTextWrap}>
                        <Text style={styles.optionTitle}>
                          {opt.title} {active ? '✓' : ''}
                        </Text>
                        <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
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
    transform: [{ translateX: -2 }],
    fontWeight: '500',
    fontSize: 20,
    marginBottom: 8,
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
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  detail: {
    color: colors.secondaryText,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  optionRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  optionRowActive: {
    borderColor: colors.primary,
    backgroundColor: '#131b2a',
  },
  optionRowInactive: {
    borderColor: colors.border,
    backgroundColor: '#1a2232',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  optionSubtitle: {
    marginTop: 3,
    color: colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
});
