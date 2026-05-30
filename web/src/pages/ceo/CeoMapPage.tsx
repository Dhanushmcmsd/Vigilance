import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';

// Fix Leaflet default marker icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Branch {
  id: string;
  branch_name: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}

interface Inspection {
  id: string;
  branch_id: string;
  officer_latitude: number | null;
  officer_longitude: number | null;
  status: string;
  inspection_date: string;
  compliance_score: number | null;
  risk_level: string | null;
  branch_name?: string;
  officer_name?: string;
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_COLOURS: Record<RiskLevel | 'unknown', string> = {
  low: '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444',
  unknown: '#94a3b8',
};

function riskColour(level: string | null | undefined): string {
  return RISK_COLOURS[(level?.toLowerCase() as RiskLevel) ?? 'unknown'] ?? RISK_COLOURS.unknown;
}

function makeCircleIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const BLUE_BRANCH_ICON = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const KERALA_CENTER: L.LatLngExpression = [10.8505, 76.2711];
const DEFAULT_ZOOM = 8;

async function fetchBranches(): Promise<Branch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, branch_name, city, latitude, longitude')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []) as Branch[];
}

async function fetchInspections(): Promise<Inspection[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from('inspections')
    .select(
      `id, branch_id, officer_latitude, officer_longitude,
      status, inspection_date, compliance_score, risk_level,
      branches ( branch_name ),
      user_roles ( name )`,
    )
    .gte('inspection_date', since.toISOString().split('T')[0]);
  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    branch_name: row.branches?.branch_name ?? 'Unknown',
    officer_name: row.user_roles?.name ?? 'Unknown',
  }));
}

export default function CeoMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
  });

  const { data: inspections, isLoading: inspectionsLoading } = useQuery({
    queryKey: ['inspections', 'recent'],
    queryFn: fetchInspections,
  });

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return; // Already initialized

    mapInstanceRef.current = L.map(mapRef.current).setView(KERALA_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Branch markers (blue)
    if (branches) {
      branches.forEach((b) => {
        if (b.latitude !== null && b.longitude !== null) {
          const marker = L.marker([b.latitude, b.longitude], { icon: BLUE_BRANCH_ICON });
          marker.bindPopup(`<strong>${b.branch_name}</strong><br/>${b.city}`);
          marker.addTo(mapInstanceRef.current!);
          markersRef.current.push(marker);
        }
      });
    }

    // Inspection markers (colored by risk)
    if (inspections) {
      inspections.forEach((insp) => {
        if (insp.officer_latitude !== null && insp.officer_longitude !== null) {
          const color = riskColour(insp.risk_level);
          const marker = L.marker([insp.officer_latitude, insp.officer_longitude], {
            icon: makeCircleIcon(color),
          });
          const popupText = `
            <div>
              <strong>${insp.branch_name}</strong><br/>
              Officer: ${insp.officer_name}<br/>
              Risk: <span style="color: ${color}; font-weight: bold;">${insp.risk_level ?? 'unknown'}</span><br/>
              Date: ${new Date(insp.inspection_date).toLocaleDateString()}
            </div>
          `;
          marker.bindPopup(popupText);
          marker.addTo(mapInstanceRef.current!);
          markersRef.current.push(marker);
        }
      });
    }
  }, [branches, inspections]);

  return (
    <div className="h-screen flex flex-col">
      <div className="px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <h1 className="text-2xl font-bold text-gray-50 mb-2">Store Map</h1>
        <p className="text-sm text-gray-400">Dashboard / Store Map</p>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {(branchesLoading || inspectionsLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
            <div className="text-white text-sm">Loading map data...</div>
          </div>
        )}
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#0A0A0F',
          }}
        />
      </div>

      <div className="px-6 py-4 border-t bg-gray-900/50" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
            <span className="text-gray-300">Store Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            <span className="text-gray-300">Low Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#eab308' }} />
            <span className="text-gray-300">Medium Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f97316' }} />
            <span className="text-gray-300">High Risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <span className="text-gray-300">Critical Risk</span>
          </div>
        </div>
      </div>
    </div>
  );
}
