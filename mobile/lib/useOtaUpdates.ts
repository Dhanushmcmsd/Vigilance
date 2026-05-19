import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Production/preview: fetch OTA from expo.dev and reload when a newer bundle exists.
 * Checks on cold start and whenever the app returns to the foreground.
 */
export function useOtaUpdates(): void {
  useEffect(() => {
    if (__DEV__) return;

    let cancelled = false;

    const run = async () => {
      try {
        if (!Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        await Updates.fetchUpdateAsync();
        if (!cancelled) {
          await Updates.reloadAsync();
        }
      } catch {
        // Non-fatal — keep embedded bundle.
      }
    };

    void run();

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') void run();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
