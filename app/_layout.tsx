import React from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { colors } from '../constants/colors';

/**
 * Root navigator.
 *
 * Responsibilities:
 * - Kicks off session loading once on app start.
 * - Shows a loading screen until auth state is ready.
 *
 * Routing:
 * - Actual redirects happen in group layouts:
 *   - `app/(auth)/_layout.tsx` for unauthenticated screens
 *   - `app/(tabs)/_layout.tsx` for authenticated tabs
 */
export default function AppLayout() {
  const ready = useAuthStore((s) => s.ready);
  const loadSession = useAuthStore((s) => s.loadSession);

  // Load session when the app mounts.
  React.useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // Prevent route flashes until we know whether the user is logged in.
  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
