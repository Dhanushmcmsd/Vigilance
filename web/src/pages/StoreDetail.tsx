import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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

export default function StoreDetail() {
  const { storeId } = useParams();
  const [store, setStore] = useState<Store | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('checking');
  const [distanceMetres, setDistanceMetres] = useState<number | null>(null);

  useEffect(() => {
    const loadStore = async () => {
      const { data } = await supabase
        .from('stores')
        .select('id, name, store_incharge, address, lat, lng')
        .eq('id', storeId)
        .single();
      if (data) setStore(data);
    };
    if (storeId) loadStore();
  }, [storeId]);

  useEffect(() => {
    if (!store) return;

    const check = async () => {
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
          return;
        }

        const dist = haversineMetres(officerLat, officerLng, storeLat, storeLng);
        if (dist <= 200) {
          setGpsStatus('ok');
        } else {
          setGpsStatus('blocked');
          setDistanceMetres(Math.round(dist));
        }
      } catch {
        setGpsStatus('error');
      }
    };

    check();
  }, [store]);

  const mapUrl = useMemo(() => {
    if (!store || store.lat == null || store.lng == null) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
  }, [store]);

  if (!store) return <div className="p-6">Loading store...</div>;

  return (
    <div className="p-6 space-y-3">
      <h1 className="text-2xl font-bold text-gray-900">{store.name}</h1>
      <p className="text-gray-700">Incharge: {store.store_incharge ?? 'Not set'}</p>
      <p className="text-gray-600">{store.address ?? 'Address not set'}</p>

      {gpsStatus === 'blocked' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-700 font-medium">
            You are {distanceMetres ?? '?'}m away from this store. You must be within 200m to submit.
          </p>
          {mapUrl ? (
            <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-blue-700 underline">
              Open map pin
            </a>
          ) : null}
        </div>
      ) : null}

      {gpsStatus === 'warning' ? (
        <p className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-yellow-800">
          Store GPS is not configured yet. Access allowed with warning.
        </p>
      ) : null}

      {gpsStatus === 'ok' ? (
        <p className="rounded-lg border border-green-300 bg-green-50 p-3 text-green-800">
          GPS verified. Vigilance sheet unlocked.
        </p>
      ) : null}
    </div>
  );
}
