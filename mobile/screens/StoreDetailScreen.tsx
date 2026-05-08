import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { haversineMetres } from '../lib/haversine';

type Store = {
  id: string;
  name: string;
  store_incharge: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

type GpsStatus = 'checking' | 'ok' | 'warning' | 'blocked' | 'error';

interface Props {
  store: Store;
  onUnlocked: (data: { officerLat: number; officerLng: number; gpsStatus: Exclude<GpsStatus, 'checking' | 'error'> }) => void;
}

export default function StoreDetailScreen({ store, onUnlocked }: Props) {
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('checking');
  const [distanceMetres, setDistanceMetres] = useState<number | null>(null);

  const mapUrl = useMemo(() => {
    if (store.lat == null || store.lng == null) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
  }, [store.lat, store.lng]);

  useEffect(() => {
    const run = async () => {
      try {
        const position = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
        );
        const officerLat = position.coords.latitude;
        const officerLng = position.coords.longitude;

        const storeLat = store.lat;
        const storeLng = store.lng;

        if (storeLat == null || storeLng == null) {
          setGpsStatus('warning');
          onUnlocked({ officerLat, officerLng, gpsStatus: 'warning' });
          return;
        }

        const dist = haversineMetres(officerLat, officerLng, storeLat, storeLng);
        if (dist <= 200) {
          setGpsStatus('ok');
          onUnlocked({ officerLat, officerLng, gpsStatus: 'ok' });
        } else {
          setGpsStatus('blocked');
          setDistanceMetres(Math.round(dist));
        }
      } catch {
        setGpsStatus('error');
      }
    };

    run();
  }, [store, onUnlocked]);

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#f8fafc', gap: 10 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>{store.name}</Text>
      <Text style={{ color: '#374151' }}>Incharge: {store.store_incharge ?? 'Not set'}</Text>
      <Text style={{ color: '#6b7280' }}>{store.address ?? 'Address not set'}</Text>

      {gpsStatus === 'blocked' ? (
        <View style={{ marginTop: 12, backgroundColor: '#fee2e2', borderRadius: 10, padding: 12 }}>
          <Text style={{ color: '#991b1b', fontWeight: '600' }}>
            You are {distanceMetres ?? '?'}m away from this store. You must be within 200m to submit.
          </Text>
          {mapUrl ? (
            <TouchableOpacity onPress={() => Linking.openURL(mapUrl)}>
              <Text style={{ marginTop: 8, color: '#1d4ed8', fontWeight: '600' }}>Open map pin</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {gpsStatus === 'warning' ? (
        <Text style={{ color: '#92400e' }}>Store GPS is not configured yet. Access allowed with warning.</Text>
      ) : null}

      {gpsStatus === 'error' ? (
        <Text style={{ color: '#b91c1c' }}>Could not fetch device location. Please enable location and retry.</Text>
      ) : null}
    </View>
  );
}
