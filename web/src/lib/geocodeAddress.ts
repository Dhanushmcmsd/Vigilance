import { KERALA_DISTRICT_NAMES } from './storeRegions';

export interface GeocodeResult {
  city: string | null;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
}

function matchDistrictFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const district of KERALA_DISTRICT_NAMES) {
    if (lower.includes(district.toLowerCase())) return district;
  }
  return null;
}

function parseCityFromAddress(address: string): string | null {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
      .replace(/\b\d{6}\b/g, '')
      .replace(/\bKerala\b/gi, '')
      .replace(/\bIndia\b/gi, '')
      .trim();
    if (!part) continue;
    if (KERALA_DISTRICT_NAMES.some((d) => d.toLowerCase() === part.toLowerCase())) continue;
    if (/^\d+$/.test(part)) continue;
    return part;
  }
  return null;
}

/** Geocode a pasted address (e.g. from Google Maps) into city, district, and coordinates. */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (trimmed.length < 10) {
    return { city: null, district: null, latitude: null, longitude: null };
  }

  const districtFromText = matchDistrictFromText(trimmed);
  const cityFromText = parseCityFromAddress(trimmed);

  try {
    const query = encodeURIComponent(`${trimmed}, Kerala, India`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=in&addressdetails=1`,
      { headers: { Accept: 'application/json', 'User-Agent': 'VigilanceAdmin/1.0 (branch-setup)' } },
    );
    if (!res.ok) throw new Error('Geocode request failed');

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      address?: Record<string, string>;
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      return {
        city: cityFromText,
        district: districtFromText,
        latitude: null,
        longitude: null,
      };
    }

    const hit = data[0];
    const addr = hit.address ?? {};
    const city =
      addr.city ??
      addr.town ??
      addr.village ??
      addr.suburb ??
      addr.municipality ??
      cityFromText;
    const district =
      matchDistrictFromText(
        [addr.county, addr.state_district, addr.district, trimmed].filter(Boolean).join(' '),
      ) ?? districtFromText;

    return {
      city: city ?? cityFromText,
      district,
      latitude: Number.parseFloat(hit.lat),
      longitude: Number.parseFloat(hit.lon),
    };
  } catch {
    return {
      city: cityFromText,
      district: districtFromText,
      latitude: null,
      longitude: null,
    };
  }
}
