/**
 * Stable per-install device identity + app version for inspection audit.
 *
 * Design choices:
 *   - We never read OS-level identifiers (no IMEI, no advertising ID). Instead
 *     we generate a UUID on first launch and persist it in SecureStore.
 *     Reinstalling the app intentionally rotates this — that's an acceptable
 *     trade-off for a vigilance tool used by trusted staff on issued devices.
 *   - App version comes from `expo-constants` (`Constants.expoConfig?.version`)
 *     which mirrors the value in app.config.js — no extra dependency required.
 *   - All getters are cached after first call. Cheap to invoke anywhere in a
 *     hot path (e.g. every sync flush).
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'vms_device_id';

let cachedDeviceId: string | null = null;
let cachedAppVersion: string | null = null;

/**
 * Returns a UUID that uniquely identifies this app install. Generated lazily
 * on first call and persisted in SecureStore (Keychain on iOS, KeyStore on
 * Android). Will be the same across launches of the same install.
 */
export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing && existing.length > 8) {
      cachedDeviceId = existing;
      return existing;
    }
  } catch {
    /* fall through */
  }
  const fresh = generateUuid();
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, fresh);
  } catch {
    // If SecureStore is unavailable (e.g. web) we still return the UUID; it
    // just won't survive a reload. That's fine — the audit value is per-session.
  }
  cachedDeviceId = fresh;
  return fresh;
}

/**
 * Reads the app version from expo-constants. Falls back to "0.0.0" so the
 * server never receives `null` in app_version.
 */
export function getAppVersion(): string {
  if (cachedAppVersion) return cachedAppVersion;
  const v =
    Constants.expoConfig?.version ??
    (Constants as { nativeAppVersion?: string | null }).nativeAppVersion ??
    null;
  cachedAppVersion = v && typeof v === 'string' ? v : '0.0.0';
  return cachedAppVersion;
}

/**
 * Convenience tuple for the sync queue:
 *   `const { deviceId, appVersion, platform } = await getDeviceAudit();`
 * Always succeeds.
 */
export async function getDeviceAudit(): Promise<{
  deviceId: string;
  appVersion: string;
  platform: string;
}> {
  const deviceId = await getDeviceId();
  return {
    deviceId,
    appVersion: getAppVersion(),
    platform: `${Platform.OS}-${Platform.Version}`,
  };
}

// ── RFC 4122 v4 UUID generator (no extra dep) ──────────────────────────────
// We avoid `crypto.randomUUID()` because it's missing on some older Android
// JSC builds we still support.
function generateUuid(): string {
  const hex = '0123456789abcdef';
  const out: string[] = [];
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out.push('-');
    } else if (i === 14) {
      out.push('4');
    } else if (i === 19) {
      out.push(hex[(Math.random() * 4) | 8]);
    } else {
      out.push(hex[(Math.random() * 16) | 0]);
    }
  }
  return out.join('');
}
