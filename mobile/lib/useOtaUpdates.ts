import { useEffect, useRef } from 'react';
import { Alert, AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';

const OTA_PENDING_APPLY_KEY = 'ota_pending_apply';
const OTA_TARGET_UPDATE_ID_KEY = 'ota_target_update_id';

function formatUpdateDetails(): string {
  const lines: string[] = [];
  const runtime = Updates.runtimeVersion;
  if (runtime) lines.push(`App version: ${runtime}`);
  if (Updates.updateId) lines.push(`Current bundle: ${Updates.updateId.slice(0, 8)}…`);
  if (Updates.createdAt) {
    lines.push(`Bundle date: ${new Date(Updates.createdAt).toLocaleString()}`);
  }
  return lines.length ? lines.join('\n') : 'A new version is ready to install.';
}

async function showUpdateSuccessIfNeeded(): Promise<void> {
  const pending = await AsyncStorage.getItem(OTA_PENDING_APPLY_KEY);
  if (pending !== '1') return;

  const targetId = await AsyncStorage.getItem(OTA_TARGET_UPDATE_ID_KEY);
  await AsyncStorage.multiRemove([OTA_PENDING_APPLY_KEY, OTA_TARGET_UPDATE_ID_KEY]);

  const currentId = Updates.updateId ?? 'unknown';
  const matched = !targetId || targetId === currentId;

  Alert.alert(
    matched ? 'Update successful' : 'App restarted',
    matched
      ? `The latest update was installed successfully.\n\n${formatUpdateDetails()}`
      : `The app restarted after an update. If something looks wrong, contact support.\n\nRunning bundle: ${currentId.slice(0, 8)}…`,
    [{ text: 'OK' }],
  );
}

function promptInstallUpdate(onInstall: () => void, onLater: () => void): void {
  Alert.alert(
    'Update available',
    `A new update has been downloaded and is ready to install.\n\n${formatUpdateDetails()}\n\nRestart now to apply the update. You can verify success on the next screen.`,
    [
      { text: 'Later', style: 'cancel', onPress: onLater },
      { text: 'Update now', onPress: onInstall },
    ],
    { cancelable: true },
  );
}

function promptDownloadFailed(onRetry: () => void): void {
  Alert.alert(
    'Update download failed',
    'Could not download the update. Check your connection and try again.',
    [
      { text: 'Later', style: 'cancel' },
      { text: 'Retry', onPress: onRetry },
    ],
  );
}

/**
 * Production/preview: check expo.dev for OTA bundles, prompt before reload,
 * then confirm success after restart (for rollout verification).
 */
export function useOtaUpdates(): void {
  const busyRef = useRef(false);
  const promptOpenRef = useRef(false);
  const offeredUpdateIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (__DEV__) return;

    let cancelled = false;

    const applyUpdate = async (manifestUpdateId?: string) => {
      try {
        await AsyncStorage.setItem(OTA_PENDING_APPLY_KEY, '1');
        if (manifestUpdateId) {
          await AsyncStorage.setItem(OTA_TARGET_UPDATE_ID_KEY, manifestUpdateId);
        }
        await Updates.reloadAsync();
      } catch {
        await AsyncStorage.multiRemove([OTA_PENDING_APPLY_KEY, OTA_TARGET_UPDATE_ID_KEY]);
        Alert.alert(
          'Could not apply update',
          'Restart the app manually. If the problem continues, reinstall from the latest build link.',
        );
      }
    };

    const checkAndOffer = async () => {
      if (cancelled || busyRef.current || promptOpenRef.current) return;
      if (!Updates.isEnabled) return;

      busyRef.current = true;
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;

        const fetch = await Updates.fetchUpdateAsync();
        if (cancelled) return;

        const newId =
          (fetch.manifest as { id?: string } | undefined)?.id ??
          Updates.updateId ??
          'pending';

        if (offeredUpdateIdRef.current === newId) return;

        promptOpenRef.current = true;
        offeredUpdateIdRef.current = newId;

        promptInstallUpdate(
          () => {
            promptOpenRef.current = false;
            void applyUpdate(newId);
          },
          () => {
            promptOpenRef.current = false;
          },
        );
      } catch {
        if (!cancelled) {
          promptOpenRef.current = true;
          promptDownloadFailed(() => {
            promptOpenRef.current = false;
            void checkAndOffer();
          });
        }
      } finally {
        busyRef.current = false;
      }
    };

    void (async () => {
      await showUpdateSuccessIfNeeded();
      if (!cancelled) await checkAndOffer();
    })();

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void showUpdateSuccessIfNeeded().then(() => {
          if (!cancelled) void checkAndOffer();
        });
      }
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
