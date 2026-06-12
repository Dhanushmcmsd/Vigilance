import { KERALA_DISTRICTS } from './keralaDistricts';

/** Canonical Kerala district names (12 districts with Vigilance stores). */
export const KERALA_DISTRICT_NAMES = KERALA_DISTRICTS.map((d) => d.name);

/** Store code → district. Authoritative mapping for all 80 Vigilance stores. */
export const STORE_DISTRICT_BY_CODE: Record<string, string> = {
  // Thiruvananthapuram — 11
  V180: 'Thiruvananthapuram',
  V124: 'Thiruvananthapuram',
  V159: 'Thiruvananthapuram',
  V122: 'Thiruvananthapuram',
  V158: 'Thiruvananthapuram',
  V177: 'Thiruvananthapuram',
  V129: 'Thiruvananthapuram',
  V136: 'Thiruvananthapuram',
  V181: 'Thiruvananthapuram',
  V128: 'Thiruvananthapuram',
  V148: 'Thiruvananthapuram',
  // Kollam — 9
  V102: 'Kollam',
  V107: 'Kollam',
  V105: 'Kollam',
  V197: 'Kollam',
  V176: 'Kollam',
  V101: 'Kollam',
  V191: 'Kollam',
  V182: 'Kollam',
  V121: 'Kollam',
  // Pathanamthitta — 6
  V104: 'Pathanamthitta',
  V175: 'Pathanamthitta',
  V123: 'Pathanamthitta',
  V117: 'Pathanamthitta',
  V125: 'Pathanamthitta',
  V143: 'Pathanamthitta',
  // Alappuzha — 14
  V140: 'Alappuzha',
  V150: 'Alappuzha',
  V116: 'Alappuzha',
  V106: 'Alappuzha',
  V103: 'Alappuzha',
  V115: 'Alappuzha',
  V137: 'Alappuzha',
  V113: 'Alappuzha',
  V119: 'Alappuzha',
  V139: 'Alappuzha',
  V133: 'Alappuzha',
  V126: 'Alappuzha',
  V127: 'Alappuzha',
  V134: 'Alappuzha',
  // Kottayam — 7
  V166: 'Kottayam',
  V179: 'Kottayam',
  V163: 'Kottayam',
  V130: 'Kottayam',
  V164: 'Kottayam',
  V145: 'Kottayam',
  V165: 'Kottayam',
  // Ernakulam — 4
  V189: 'Ernakulam',
  V112: 'Ernakulam',
  V138: 'Ernakulam',
  V153: 'Ernakulam',
  // Thrissur — 10
  V190: 'Thrissur',
  V135: 'Thrissur',
  V161: 'Thrissur',
  V109: 'Thrissur',
  V146: 'Thrissur',
  V151: 'Thrissur',
  V108: 'Thrissur',
  V132: 'Thrissur',
  V149: 'Thrissur',
  V144: 'Thrissur',
  // Palakkad — 9
  V111: 'Palakkad',
  V152: 'Palakkad',
  V167: 'Palakkad',
  V196: 'Palakkad',
  V178: 'Palakkad',
  V147: 'Palakkad',
  V142: 'Palakkad',
  V195: 'Palakkad',
  V168: 'Palakkad',
  // Malappuram — 3
  V170: 'Malappuram',
  V173: 'Malappuram',
  V169: 'Malappuram',
  // Kozhikode — 5
  V172: 'Kozhikode',
  V198: 'Kozhikode',
  V184: 'Kozhikode',
  V185: 'Kozhikode',
  V171: 'Kozhikode',
  // Wayanad — 1
  V188: 'Wayanad',
  // Kannur — 1
  V183: 'Kannur',
};

const DISTRICT_ALIASES: Record<string, string> = {
  trivandrum: 'Thiruvananthapuram',
  'thiruvananthapuram district': 'Thiruvananthapuram',
  kolam: 'Kollam',
  'kollam district': 'Kollam',
  'pathanamthitta district': 'Pathanamthitta',
  'alappuzha district': 'Alappuzha',
  'kottayam district': 'Kottayam',
  'ernakulam district': 'Ernakulam',
  'thrissur district': 'Thrissur',
  'palakkad district': 'Palakkad',
  'malappuram district': 'Malappuram',
  'kozhikode district': 'Kozhikode',
  'wayanad district': 'Wayanad',
  'kannur district': 'Kannur',
};

export function districtForStoreCode(storeCode: string | null | undefined): string | null {
  if (!storeCode?.trim()) return null;
  return STORE_DISTRICT_BY_CODE[storeCode.trim().toUpperCase()] ?? null;
}

/** Normalize legacy or abbreviated region values to canonical district names. */
export function canonicalDistrict(region: string | null | undefined): string {
  const value = region?.trim();
  if (!value) return 'Unknown District';

  if (KERALA_DISTRICT_NAMES.includes(value)) return value;

  const alias = DISTRICT_ALIASES[value.toLowerCase()];
  if (alias) return alias;

  const partial = KERALA_DISTRICT_NAMES.find(
    (d) => value.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(value.toLowerCase()),
  );
  if (partial) return partial;

  return value;
}
