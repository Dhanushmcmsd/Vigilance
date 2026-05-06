import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from './supabase';

interface UseLocationPingOptions {
  inspectionId: string | null;
  isActive: boolean;
}

interface UseLocationPingResult {
  pingCount: number;
}

/**
 * Silently records the officer's GPS position into inspection_location_pings
 * every 60 seconds (or whenever they move more than 50 m).
 *
 * - Starts automatically when isActive=true and inspectionId is set.
 * - Stops on unmount or when isActive becomes false.
 * - All errors are swallowed — a failed ping never affects the inspection flow.
 */
export function useLocationPing({
  inspectionId,
  isActive,
}: UseLocationPingOptions): UseLocationPingResult {
  const [pingCount, setPingCount] = useState(0);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!isActive || !inspectionId) {
      return;
    }

    let cancelled = false;

    const startWatching = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60_000,   // minimum 60 s between updates
            distanceInterval: 50,   // or if moved 50 m, whichever comes first
          },
          async (location) => {
            if (cancelled) return;
            try {
              await supabase.from('inspection_location_pings').insert({
                inspection_id: inspectionId,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy ?? null,
                recorded_at: new Date().toISOString(),
              });
              setPingCount((n) => n + 1);
            } catch {
              // Silent failure — ping loss is acceptable
            }
          }
        );

        if (cancelled) {
          sub.remove();
          return;
        }

        subscriptionRef.current = sub;
      } catch {
        // Silent failure — permission denied or location unavailable
      }
    };

    startWatching();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [isActive, inspectionId]);

  return { pingCount };
}
