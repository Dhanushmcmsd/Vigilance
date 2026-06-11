export interface DistrictCentroid {
  name: string;
  lat: number;
  lng: number;
  color: string;
}

export const KERALA_CENTER = { lat: 10.8505, lng: 76.2711 };
export const KERALA_OVERVIEW_ZOOM = 7;
export const DISTRICT_ZOOM = 11;
export const CONNECTION_MAX_KM = 150;

export const KERALA_DISTRICTS: DistrictCentroid[] = [
  { name: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366, color: '#3b82f6' },
  { name: 'Kollam', lat: 8.8932, lng: 76.6141, color: '#06b6d4' },
  { name: 'Pathanamthitta', lat: 9.2648, lng: 76.7870, color: '#8b5cf6' },
  { name: 'Alappuzha', lat: 9.4981, lng: 76.3388, color: '#ec4899' },
  { name: 'Kottayam', lat: 9.5916, lng: 76.5222, color: '#f59e0b' },
  { name: 'Ernakulam', lat: 10.0159, lng: 76.3419, color: '#10b981' },
  { name: 'Thrissur', lat: 10.5276, lng: 76.2144, color: '#6366f1' },
  { name: 'Palakkad', lat: 10.7867, lng: 76.6548, color: '#14b8a6' },
  { name: 'Malappuram', lat: 11.0510, lng: 76.0711, color: '#f97316' },
  { name: 'Kozhikode', lat: 11.2588, lng: 75.7804, color: '#ef4444' },
  { name: 'Wayanad', lat: 11.6854, lng: 76.1320, color: '#84cc16' },
  { name: 'Kannur', lat: 11.8745, lng: 75.3704, color: '#a855f7' },
];

export const KERALA_GEOJSON_URL =
  'https://raw.githubusercontent.com/datameet/maps/master/Districts/Kerala.geojson';

/** Great-circle distance in kilometres (Haversine). */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
