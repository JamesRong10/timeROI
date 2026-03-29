import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { useTimeStore } from '../../store/useTimeStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';

/**
 * Authenticated Tabs layout.
 *
 * What it does:
 * - If not logged in: redirects to the login screen.
 * - If logged in: hydrates per-user data (time entries + preferences).
 */
export default function TabsLayout() {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const hydrateForUser = useTimeStore((s) => s.hydrateForUser);
  const clear = useTimeStore((s) => s.clear);
  const hydratePreferencesForUser = usePreferencesStore((s) => s.hydrateForUser);
  const clearPreferences = usePreferencesStore((s) => s.clear);

  React.useEffect(() => {
    if (!ready) return;
    if (!user) {
      // Ensure user-specific data doesn't leak between sessions.
      clear();
      clearPreferences();
      return;
    }
    // Load user data after successful login/session restore.
    void hydrateForUser(user.id);
    void hydratePreferencesForUser(user.id);
  }, [ready, user?.id, hydrateForUser, hydratePreferencesForUser, clear, clearPreferences]);

  if (!ready) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return <Tabs />;
}
