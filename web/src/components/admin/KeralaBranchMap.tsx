import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  GeoJSON,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import {
  CONNECTION_MAX_KM,
  DISTRICT_ZOOM,
  KERALA_CENTER,
  KERALA_DISTRICTS,
  KERALA_GEOJSON_URL,
  KERALA_OVERVIEW_ZOOM,
  haversineKm,
  initials,
} from '../../lib/keralaDistricts';

import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface DistrictAssignmentRow {
  id: string;
  district: string;
  officer_id: string | null;
  is_on_leave: boolean;
  officer?: {
    id: string;
    name: string;
    profile_photo_url: string | null;
  } | null;
}

interface StorePin {
  id: string;
  store_code: string | null;
  name: string;
  address: string | null;
  store_incharge: string | null;
  lat: number;
  lng: number;
}

interface DistrictConnection {
  key: string;
  positions: [number, number][];
  distanceKm: number;
  midpoint: [number, number];
}

function ZoomWatcher({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  return null;
}

function FlyController({
  target,
}: {
  target: { lat: number; lng: number; zoom: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2 });
    }
  }, [map, target]);
  return null;
}

function makeDistrictIcon(
  district: string,
  color: string,
  officerName: string,
  photoUrl: string | null,
) {
  const avatar = photoUrl
    ? `<img src="${photoUrl}" alt="" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid ${color};" />`
    : `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,${color},#1e3a8a);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;border:2px solid rgba(255,255,255,0.4);">${initials(officerName)}</div>`;

  return L.divIcon({
    className: 'district-officer-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;">
      ${avatar}
      <span style="font-size:9px;font-weight:600;color:#e2e8f0;text-shadow:0 1px 3px rgba(0,0,0,0.9);white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;">${district}</span>
    </div>`,
    iconSize: [90, 56],
    iconAnchor: [45, 28],
  });
}

export function KeralaBranchMap({
  onAddBranch,
}: {
  onAddBranch: () => void;
}) {
  const [zoom, setZoom] = useState(KERALA_OVERVIEW_ZOOM);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  const [keralaOutline, setKeralaOutline] = useState<GeoJSON.GeoJsonObject | null>(null);

  const { data: assignments = [] } = useQuery<DistrictAssignmentRow[]>({
    queryKey: ['district-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('district_assignments')
        .select(
          `id, district, officer_id, is_on_leave,
           officer:user_roles!district_assignments_officer_id_fkey ( id, name, profile_photo_url )`,
        )
        .eq('is_primary', true)
        .order('district');
      if (error) throw error;
      return (data ?? []).map((row) => {
        const officer = Array.isArray(row.officer) ? row.officer[0] : row.officer;
        return { ...row, officer: officer ?? null };
      });
    },
  });

  const assignmentByDistrict = useMemo(() => {
    const map: Record<string, DistrictAssignmentRow> = {};
    assignments.forEach((a) => {
      map[a.district] = a;
    });
    return map;
  }, [assignments]);

  const { data: districtStores = [] } = useQuery<StorePin[]>({
    queryKey: ['district-stores', selectedDistrict],
    enabled: !!selectedDistrict && zoom >= 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, store_code, name, address, store_incharge, lat, lng')
        .eq('region', selectedDistrict!)
        .not('lat', 'is', null)
        .not('lng', 'is', null);
      if (error) throw error;
      return (data ?? []).filter(
        (s): s is StorePin => s.lat != null && s.lng != null,
      );
    },
  });

  useEffect(() => {
    let cancelled = false;
    fetch(KERALA_GEOJSON_URL)
      .then((r) => r.json())
      .then((geo) => {
        if (!cancelled) setKeralaOutline(geo as GeoJSON.GeoJsonObject);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const connections = useMemo((): DistrictConnection[] => {
    const lines: DistrictConnection[] = [];
    for (let i = 0; i < KERALA_DISTRICTS.length; i++) {
      for (let j = i + 1; j < KERALA_DISTRICTS.length; j++) {
        const a = KERALA_DISTRICTS[i];
        const b = KERALA_DISTRICTS[j];
        const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
        if (km <= CONNECTION_MAX_KM) {
          lines.push({
            key: `${a.name}-${b.name}`,
            positions: [
              [a.lat, a.lng],
              [b.lat, b.lng],
            ],
            distanceKm: Math.round(km),
            midpoint: [(a.lat + b.lat) / 2, (a.lng + b.lng) / 2],
          });
        }
      }
    }
    return lines;
  }, []);

  const handleDistrictClick = useCallback((district: string, lat: number, lng: number) => {
    setSelectedDistrict(district);
    setFlyTarget({ lat, lng, zoom: DISTRICT_ZOOM });
  }, []);

  const handleBackToKerala = useCallback(() => {
    setSelectedDistrict(null);
    setFlyTarget({
      lat: KERALA_CENTER.lat,
      lng: KERALA_CENTER.lng,
      zoom: KERALA_OVERVIEW_ZOOM,
    });
  }, []);

  const showConnections = zoom < 10;

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700 h-[480px]">
      <MapContainer
        center={[KERALA_CENTER.lat, KERALA_CENTER.lng]}
        zoom={KERALA_OVERVIEW_ZOOM}
        className="h-full w-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ZoomWatcher onZoom={setZoom} />
        <FlyController target={flyTarget} />

        {keralaOutline && zoom < 10 && (
          <GeoJSON
            data={keralaOutline as GeoJSON.GeoJsonObject}
            style={{
              color: '#63b3ed',
              weight: 2,
              fillColor: '#1e3a5f',
              fillOpacity: 0.25,
            }}
          />
        )}

        {showConnections &&
          connections.map((c) => (
            <React.Fragment key={c.key}>
              <Polyline
                positions={c.positions}
                pathOptions={{
                  color: 'rgba(99, 179, 237, 0.7)',
                  weight: 2,
                  dashArray: '8 6',
                  className: 'district-connection-line',
                }}
              />
              <Marker
                position={c.midpoint}
                icon={L.divIcon({ className: 'connection-midpoint', html: '', iconSize: [0, 0] })}
                opacity={0}
              >
                <Tooltip sticky>{c.distanceKm} km</Tooltip>
              </Marker>
            </React.Fragment>
          ))}

        {KERALA_DISTRICTS.map((d) => {
          const assignment = assignmentByDistrict[d.name];
          const officerName = assignment?.officer?.name ?? `${d.name} Officer`;
          const photo = assignment?.officer?.profile_photo_url ?? null;
          return (
            <Marker
              key={d.name}
              position={[d.lat, d.lng]}
              icon={makeDistrictIcon(d.name, d.color, officerName, photo)}
              eventHandlers={{
                click: () => handleDistrictClick(d.name, d.lat, d.lng),
              }}
            >
              <Tooltip direction="top" offset={[0, -20]}>
                {officerName}
              </Tooltip>
            </Marker>
          );
        })}

        {selectedDistrict &&
          zoom >= 10 &&
          districtStores.map((store) => (
            <Marker key={store.id} position={[store.lat, store.lng]}>
              <Popup>
                <div className="text-sm space-y-1 min-w-[160px]">
                  <p className="font-bold">{store.store_code ?? '—'}</p>
                  <p>{store.name}</p>
                  {store.address && (
                    <p className="text-gray-600 text-xs">{store.address}</p>
                  )}
                  {store.store_incharge && (
                    <p className="text-xs">
                      In-charge: <strong>{store.store_incharge}</strong>
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {selectedDistrict && zoom >= 10 && (
        <button
          type="button"
          onClick={handleBackToKerala}
          className="absolute top-3 left-3 z-[1000] rounded-lg bg-slate-900/90 border border-slate-600 text-slate-100 text-sm px-3 py-1.5 hover:bg-slate-800 shadow-lg"
        >
          ← Back to Kerala
        </button>
      )}

      <button
        type="button"
        onClick={onAddBranch}
        className="absolute top-3 right-3 z-[1000] btn-primary shadow-lg"
      >
        + Add Branch
      </button>
    </div>
  );
}
