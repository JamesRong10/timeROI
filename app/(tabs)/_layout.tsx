import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useTimeStore } from '../../store/useTimeStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useStreakStore } from '../../store/useStreakStore';
import { useDailyQuestsStore } from '../../store/useDailyQuestsStore';

/**
 * Authenticated Tabs layout.
 *
 * What it does:
 * - If not logged in: redirects to the login screen.
 * - If logged in: hydrates per-user data (time entries + preferences).
 */
export default function TabsLayout() {
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const guest = useAuthStore((s) => s.guest);
  const hydrateForUser = useTimeStore((s) => s.hydrateForUser);
  const hydrateGuest = useTimeStore((s) => s.hydrateGuest);
  const clear = useTimeStore((s) => s.clear);
  const hydratePreferencesForUser = usePreferencesStore((s) => s.hydrateForUser);
  const clearPreferences = usePreferencesStore((s) => s.clear);
  const hydrateStreakForIdentity = useStreakStore((s) => s.hydrateForIdentity);
  const clearStreak = useStreakStore((s) => s.clear);
  const hydrateDailyQuestsForIdentity = useDailyQuestsStore((s) => s.hydrateForIdentity);
  const clearDailyQuests = useDailyQuestsStore((s) => s.clear);

  React.useEffect(() => {
    if (loading) return;
    if (!user && !guest) {
      // Ensure user-specific data doesn't leak between sessions.
      clear();
      clearPreferences();
      clearStreak();
      clearDailyQuests();
      return;
    }
    if (guest) {
      // Guest mode: use in-memory sample data and no preferences.
      hydrateGuest();
      clearPreferences();
      void hydrateStreakForIdentity('guest');
      void hydrateDailyQuestsForIdentity('guest');
      return;
    }
    if (user) {
      // Load user data after successful login/session restore.
      void hydrateForUser(user.id);
      void hydratePreferencesForUser(user.id);
      void hydrateStreakForIdentity(user.id);
      void hydrateDailyQuestsForIdentity(user.id);
    }
  }, [
    loading,
    user?.id,
    guest,
    hydrateForUser,
    hydratePreferencesForUser,
    hydrateGuest,
    hydrateStreakForIdentity,
    hydrateDailyQuestsForIdentity,
    clear,
    clearPreferences,
    clearStreak,
    clearDailyQuests,
  ]);

  if (loading) return null;
  if (!user && !guest) return <Redirect href="/(auth)" />;

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
