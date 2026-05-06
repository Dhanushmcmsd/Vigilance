/**
 * MapView.tsx — Phase 6 Scaffold
 * Management map showing branches and recent inspections via Leaflet + OpenStreetMap.
 * FUTURE USE: Registered in App.tsx router but NOT added to sidebar navigation yet.
 * To enable nav item, search for: // FUTURE: Map View
 */

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';

// Fix Leaflet default marker icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Types ────────────────────────────────────────────────────────────────────
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
  // joined
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

// ── Kerala centre default ─────────────────────────────────────────────────────
const KERALA_CENTER: L.LatLngExpression = [10.8505, 76.2711];
const DEFAULT_ZOOM = 8;

// ── Data fetchers ─────────────────────────────────────────────────────────────
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
    .select(`
      id, branch_id, officer_latitude, officer_longitude,
      status, inspection_date, compliance_score, risk_level,
      branches ( branch_name ),
      user_roles ( name )
    `)
    .gte('inspection_date', since.toISOString().split('T')[0]);
  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    ...row,
    branch_name: row.branches?.branch_name ?? '—',
    officer_name: row.user_roles?.name ?? '—',
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const branchLayerRef = useRef<L.LayerGroup | null>(null);
  const inspectionLayerRef = useRef<L.LayerGroup | null>(null);

  const [showBranches, setShowBranches] = useState(true);
  const [showInspections, setShowInspections] = useState(true);

  // Date range filter
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Risk level filter
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const { data: branches = [] } = useQuery({ queryKey: ['map-branches'], queryFn: fetchBranches });
  const { data: inspections = [] } = useQuery({ queryKey: ['map-inspections'], queryFn: fetchInspections });

  // Build a branchId → branch lookup for fallback coordinates
  const branchById = Object.fromEntries(branches.map((b) => [b.id, b]));

  // ── Init Leaflet map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: KERALA_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    branchLayerRef.current = L.layerGroup().addTo(map);
    inspectionLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Render branch markers ─────────────────────────────────────────────────
  useEffect(() => {
    const layer = branchLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showBranches) return;

    branches.forEach((b) => {
      if (b.latitude == null || b.longitude == null) return; // skip silently

      // Count inspections this month for popup
      const thisMonth = new Date();
      const monthInspections = inspections.filter(
        (i) =>
          i.branch_id === b.id &&
          new Date(i.inspection_date).getMonth() === thisMonth.getMonth() &&
          new Date(i.inspection_date).getFullYear() === thisMonth.getFullYear()
      ).length;

      L.marker([b.latitude, b.longitude], { icon: BLUE_BRANCH_ICON })
        .bindPopup(
          `<div style="min-width:160px">
            <strong>${b.branch_name}</strong><br/>
            <span style="color:#6b7280">${b.city}</span><br/>
            <span style="font-size:12px;margin-top:4px;display:block">
              📋 ${monthInspections} inspection${monthInspections !== 1 ? 's' : ''} this month
            </span>
          </div>`
        )
        .addTo(layer);
    });
  }, [branches, inspections, showBranches]);

  // ── Render inspection markers ─────────────────────────────────────────────
  useEffect(() => {
    const layer = inspectionLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!showInspections) return;

    const filtered = inspections.filter((i) => {
      const d = i.inspection_date.split('T')[0];
      if (d < fromDate || d > toDate) return false;
      if (riskFilter !== 'all' && (i.risk_level?.toLowerCase() ?? 'unknown') !== riskFilter) return false;
      return true;
    });

    filtered.forEach((i) => {
      // Fallback: if officer coords null, use branch coords
      let lat = i.officer_latitude;
      let lon = i.officer_longitude;
      if (lat == null || lon == null) {
        const b = branchById[i.branch_id];
        if (!b || b.latitude == null || b.longitude == null) return; // skip silently
        lat = b.latitude;
        lon = b.longitude;
      }

      const color = riskColour(i.risk_level);
      L.marker([lat, lon], { icon: makeCircleIcon(color) })
        .bindPopup(
          `<div style="min-width:180px">
            <strong>${i.branch_name}</strong><br/>
            <span style="color:#6b7280">Officer: ${i.officer_name}</span><br/>
            <span style="font-size:12px">${i.inspection_date.split('T')[0]}</span><br/>
            <span style="font-size:12px">
              Score: ${i.compliance_score ?? '—'} &nbsp;|
              Risk: <span style="color:${color};font-weight:600">
                ${i.risk_level ?? '—'}
              </span>
            </span><br/>
            <span style="font-size:12px;color:#6b7280">Status: ${i.status}</span>
          </div>`
        )
        .addTo(layer);
    });
  }, [inspections, branchById, showInspections, fromDate, toDate, riskFilter]);

  // ── Sync layer visibility toggles ────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !branchLayerRef.current) return;
    if (showBranches) mapRef.current.addLayer(branchLayerRef.current);
    else mapRef.current.removeLayer(branchLayerRef.current);
  }, [showBranches]);

  useEffect(() => {
    if (!mapRef.current || !inspectionLayerRef.current) return;
    if (showInspections) mapRef.current.addLayer(inspectionLayerRef.current);
    else mapRef.current.removeLayer(inspectionLayerRef.current);
  }, [showInspections]);

  return (
    <div className="flex flex-col h-full min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 mr-2">🗺️ Inspection Map</h1>

        {/* Layer toggles */}
        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showBranches}
            onChange={(e) => setShowBranches(e.target.checked)}
            className="rounded"
          />
          <span className="inline-block w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow" />
          Branches
        </label>

        <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showInspections}
            onChange={(e) => setShowInspections(e.target.checked)}
            className="rounded"
          />
          <span className="inline-block w-3 h-3 rounded-full bg-orange-400 border-2 border-white shadow" />
          Inspections (last 30 days)
        </label>

        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-500">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="text-gray-500">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
          />
        </div>

        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="all">All Risk Levels</option>
          <option value="low">🟢 Low</option>
          <option value="medium">🟡 Medium</option>
          <option value="high">🟠 High</option>
          <option value="critical">🔴 Critical</option>
        </select>

        {/* Risk legend */}
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map((r) => (
            <span key={r} className="flex items-center gap-1">
              <span
                style={{ background: RISK_COLOURS[r] }}
                className="inline-block w-2.5 h-2.5 rounded-full"
              />
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {/* Map container */}
      <div ref={mapContainerRef} className="flex-1" style={{ minHeight: '500px' }} />
    </div>
  );
}
