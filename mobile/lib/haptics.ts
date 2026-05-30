/**
 * Thin typed wrapper around expo-haptics.
 *
 * - Silently no-ops on web / unsupported platforms (so screens stay portable).
 * - Provides four semantic helpers: tap (every checklist answer / pill press),
 *   success (form submit), warning (validation error), error (server failure).
 * - Imports are dynamic so the bundle still builds if expo-haptics isn't
 *   installed yet (it's only added in the SDK 53 migration).
 */

import { Platform } from 'react-native';

type HapticsModule = typeof import('expo-haptics');

let cached: HapticsModule | null | undefined;

const getModule = (): HapticsModule | null => {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web') {
    cached = null;
    return null;
  }
  try {
    cached = require('expo-haptics') as HapticsModule;
  } catch {
    cached = null;
  }
  return cached;
};

const safe = (fn: (m: HapticsModule) => Promise<void> | void) => {
  const m = getModule();
  if (!m) return;
  try {
    void fn(m);
  } catch {
    // never let a haptic failure crash the UI
  }
};

export const haptics = {
  /** Every checklist Yes/No/N/A tap, every pill press. */
  tap: () => safe((m) => m.impactAsync(m.ImpactFeedbackStyle.Light)),
  /** Major UI nav or destructive confirm. */
  medium: () => safe((m) => m.impactAsync(m.ImpactFeedbackStyle.Medium)),
  /** Successful form submit. */
  success: () => safe((m) => m.notificationAsync(m.NotificationFeedbackType.Success)),
  /** Validation error or invalid input. */
  warning: () => safe((m) => m.notificationAsync(m.NotificationFeedbackType.Warning)),
  /** Server-side failure. */
  error: () => safe((m) => m.notificationAsync(m.NotificationFeedbackType.Error)),
};
