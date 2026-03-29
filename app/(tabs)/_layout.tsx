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
  const guest = useAuthStore((s) => s.guest);
  const hydrateForUser = useTimeStore((s) => s.hydrateForUser);
  const hydrateGuest = useTimeStore((s) => s.hydrateGuest);
  const clear = useTimeStore((s) => s.clear);
  const hydratePreferencesForUser = usePreferencesStore((s) => s.hydrateForUser);
  const clearPreferences = usePreferencesStore((s) => s.clear);

  React.useEffect(() => {
    if (!ready) return;
    if (!user && !guest) {
      // Ensure user-specific data doesn't leak between sessions.
      clear();
      clearPreferences();
      return;
    }
    if (guest) {
      // Guest mode: use in-memory sample data and no preferences.
      hydrateGuest();
      clearPreferences();
      return;
    }
    if (user) {
      // Load user data after successful login/session restore.
      void hydrateForUser(user.id);
      void hydratePreferencesForUser(user.id);
    }
  }, [ready, user?.id, guest, hydrateForUser, hydratePreferencesForUser, hydrateGuest, clear, clearPreferences]);

  if (!ready) return null;
  if (!user && !guest) return <Redirect href="/(auth)" />;

  return <Tabs />;
}
