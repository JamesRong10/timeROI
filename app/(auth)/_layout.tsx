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
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const guest = useAuthStore((s) => s.guest);

  if (loading) return null;
  if (user || guest) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
