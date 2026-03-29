import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Unauthenticated layout.
 *
 * Guard:
 * - If the user is already logged in, keep them out of auth screens and send them to tabs.
 */
export default function AuthLayout() {
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);

  if (!ready) return null;
  if (user) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
