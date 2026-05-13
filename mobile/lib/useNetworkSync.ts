/**
 * useNetworkSync — flushes the offline submission queue every time the device
 * reconnects to the network. Mount this once at the app root.
 *
 * Also exposes the current online state and the most recent flush result so
 * screens (drafts.tsx, the header banner) can react to sync progress.
 */

import { useEffect, useRef, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

import { flushQueue, FlushResult } from './syncQueue';

export interface NetworkSyncState {
  isOnline: boolean;
  lastFlush: FlushResult | null;
  syncing: boolean;
}

export function useNetworkSync(): NetworkSyncState {
  const [state, setState] = useState<NetworkSyncState>({
    isOnline: true,
    lastFlush: null,
    syncing: false,
  });
  // Guard against overlapping flushes (e.g. fast WiFi/cellular bounce).
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const runFlush = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      setState((s) => ({ ...s, syncing: true }));
      try {
        const result = await flushQueue();
        if (!cancelled) setState((s) => ({ ...s, lastFlush: result, syncing: false }));
      } catch (err) {
        if (__DEV__) console.warn('[useNetworkSync] flush threw', err);
        if (!cancelled) setState((s) => ({ ...s, syncing: false }));
      } finally {
        inFlight.current = false;
      }
    };

    const onChange = (next: NetInfoState) => {
      const online = !!next.isConnected && next.isInternetReachable !== false;
      setState((s) => ({ ...s, isOnline: online }));
      if (online) void runFlush();
    };

    // Kick once on mount in case we boot already online with a pending queue.
    NetInfo.fetch().then(onChange);
    const unsub = NetInfo.addEventListener(onChange);

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return state;
}
