import { useEffect } from 'react';
import * as Updates from 'expo-updates';

/**
 * On production/preview builds, check expo.dev for an OTA bundle and reload.
 * Skipped in Expo Go and dev client `__DEV__` mode.
 */
export function useOtaUpdates(): void {
  useEffect(() => {
    if (__DEV__) return;

    let cancelled = false;

    (async () => {
      try {
        if (!Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (!cancelled) {
          await Updates.reloadAsync();
        }
      } catch {
        // Non-fatal — user keeps running the embedded bundle.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
