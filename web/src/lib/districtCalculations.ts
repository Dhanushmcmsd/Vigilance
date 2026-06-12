import type { ManagementInspection } from './inspectionQueries';
import { computeCeoMetrics, computeSectionBreakdown } from './ceoDashboardData';
import { activityDate } from './dateRanges';
import { canonicalDistrict, KERALA_DISTRICT_NAMES } from './storeRegions';

function inspectionDayKey(row: ManagementInspection): string {
  const d = activityDate(row);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface StoreCard {
  id: string;
  name: string;
  region: string;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  complianceScore: number;
  lastInspected: string;
  hasOpenRed: boolean;
  hasOpenYellow: boolean;
}

export type HealthStatus = 'healthy' | 'normal' | 'critical';

export function storeDistrict(region: string | null | undefined): string {
  return canonicalDistrict(region);
}

export function groupByDistrict<T>(
  items: T[],
  getDistrict: (item: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const district = getDistrict(item);
    const list = map.get(district) ?? [];
    list.push(item);
    map.set(district, list);
  });
  return map;
}

export function filterInspectionsByDistrict(
  inspections: ManagementInspection[],
  district: string | null | undefined,
): ManagementInspection[] {
  if (!district) return inspections;
  return inspections.filter((i) => storeDistrict(i.region) === district);
}

export function deriveStoreHealth(store: {
  complianceScore: number;
  hasOpenRed: boolean;
  redCount: number;
}): HealthStatus {
  if (store.complianceScore < 70 || (store.hasOpenRed && store.redCount >= 2)) return 'critical';
  if (store.complianceScore >= 85 && store.redCount === 0) return 'healthy';
  return 'normal';
}

export function deriveDistrictHealth(stores: StoreCard[]): HealthStatus {
  if (!stores.length) return 'normal';
  const statuses = stores.map(deriveStoreHealth);
  if (statuses.some((s) => s === 'critical')) return 'critical';
  if (statuses.every((s) => s === 'healthy')) return 'healthy';
  return 'normal';
}

export function calcDistrictCompliance(stores: StoreCard[]): number {
  if (!stores.length) return 0;
  return Math.round(stores.reduce((sum, s) => sum + s.complianceScore, 0) / stores.length);
}

export function calcDistrictFlags(stores: StoreCard[]) {
  return {
    red: stores.reduce((sum, s) => sum + s.redCount, 0),
    yellow: stores.reduce((sum, s) => sum + s.yellowCount, 0),
    green: stores.reduce((sum, s) => sum + s.greenCount, 0),
  };
}

export function computeDistrictCards(storeCards: StoreCard[]): StoreCard[] {
  const grouped = groupByDistrict(storeCards, (s) => storeDistrict(s.region));
  return Array.from(grouped.entries())
    .map(([district, stores]) => {
      const flags = calcDistrictFlags(stores);
      const latest = stores
        .slice()
        .sort((a, b) => {
          const parse = (v: string) => {
            if (v.includes('h ago')) return 0;
            if (v.includes('d ago')) return parseInt(v, 10) * 24;
            return 9999;
          };
          return parse(a.lastInspected) - parse(b.lastInspected);
        })[0]?.lastInspected ?? '—';

      return {
        id: `district:${district}`,
        name: district,
        region: 'District',
        redCount: flags.red,
        yellowCount: flags.yellow,
        greenCount: flags.green,
        complianceScore: calcDistrictCompliance(stores),
        lastInspected: latest,
        hasOpenRed: stores.some((s) => s.hasOpenRed),
        hasOpenYellow: stores.some((s) => s.hasOpenYellow),
      };
    })
    .sort((a, b) => {
      const order = new Map(KERALA_DISTRICT_NAMES.map((name, idx) => [name, idx]));
      const orderDiff =
        (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999);
      return orderDiff || b.redCount - a.redCount || a.name.localeCompare(b.name);
    });
}

export function computeScopedMetrics(
  inspections: ManagementInspection[],
  storeCards: StoreCard[],
  district?: string | null,
) {
  const scopedInspections = filterInspectionsByDistrict(inspections, district);
  const scopedStores = district
    ? storeCards.filter((s) => storeDistrict(s.region) === district)
    : storeCards;

  const base = computeCeoMetrics(scopedInspections);
  const criticalStores = scopedStores.filter((s) => deriveStoreHealth(s) === 'critical').length;
  const flaggedForReview = scopedStores.filter((s) => s.redCount > 0).length;

  const overdueTargets = scopedStores.filter((s) => {
    const match = s.lastInspected.match(/(\d+)d ago/);
    if (match) return parseInt(match[1], 10) > 30;
    return false;
  }).length;

  return {
    ...base,
    storesAtCriticalRisk: criticalStores,
    storesFlaggedForReview: flaggedForReview,
    overdueTargetsMissed: overdueTargets,
  };
}

export function computeScopedSectionData(
  inspections: ManagementInspection[],
  district?: string | null,
) {
  return computeSectionBreakdown(filterInspectionsByDistrict(inspections, district));
}

export function calcMonthlyTrend(
  inspections: ManagementInspection[],
  district?: string | null,
): Array<{ month: string; compliance: number }> {
  const filtered = filterInspectionsByDistrict(inspections, district);
  const now = new Date();
  const points: Array<{ month: string; compliance: number }> = [];

  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    const monthRows = filtered.filter((row) => row.inspection_date.startsWith(key));
    const avg = monthRows.length
      ? monthRows.reduce((sum, row) => sum + row.compliance_score, 0) / monthRows.length
      : 0;
    points.push({ month: label, compliance: Math.round(avg * 10) / 10 });
  }

  return points;
}

export function listDistrictNames(_storeCards?: StoreCard[]): string[] {
  return [...KERALA_DISTRICT_NAMES];
}

export function calcDistrictDailyTrend(
  inspections: ManagementInspection[],
  yearMonth: string,
): Array<Record<string, string | number | null>> {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthRows = inspections.filter((row) => inspectionDayKey(row).startsWith(yearMonth));
  const districts = Array.from(new Set(monthRows.map((row) => storeDistrict(row.region)))).sort();

  return Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    const dateKey = `${yearMonth}-${String(day).padStart(2, '0')}`;
    const label = String(day);
    const row: Record<string, string | number | null> = { label };
    districts.forEach((district) => {
      const dayRows = monthRows.filter(
        (item) => inspectionDayKey(item) === dateKey && storeDistrict(item.region) === district,
      );
      row[district] = dayRows.length
        ? dayRows.reduce((sum, item) => sum + item.compliance_score, 0) / dayRows.length
        : null;
    });
    return row;
  });
}

export function calcStoreDailyTrend(
  inspections: ManagementInspection[],
  yearMonth: string,
  district: string,
): Array<Record<string, string | number | null>> {
  const [y, m] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const monthRows = filterInspectionsByDistrict(
    inspections.filter((row) => inspectionDayKey(row).startsWith(yearMonth)),
    district,
  );
  const stores = Array.from(new Set(monthRows.map((row) => row.branch_name))).sort();

  return Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    const dateKey = `${yearMonth}-${String(day).padStart(2, '0')}`;
    const label = String(day);
    const row: Record<string, string | number | null> = { label };
    stores.forEach((storeName) => {
      const dayRows = monthRows.filter(
        (item) => inspectionDayKey(item) === dateKey && item.branch_name === storeName,
      );
      row[storeName] = dayRows.length
        ? dayRows.reduce((sum, item) => sum + item.compliance_score, 0) / dayRows.length
        : null;
    });
    return row;
  });
}

export interface DistrictMonthSummary {
  district: string;
  inspectionCount: number;
  avgCompliance: number;
  trend: number;
  criticalCount: number;
}

export function computeDistrictMonthSummaries(
  monthInspections: ManagementInspection[],
  prevMonthInspections: ManagementInspection[],
): DistrictMonthSummary[] {
  const current = groupByDistrict(monthInspections, (i) => storeDistrict(i.region));
  const previous = groupByDistrict(prevMonthInspections, (i) => storeDistrict(i.region));

  const districtOrder = new Map(KERALA_DISTRICT_NAMES.map((name, idx) => [name, idx]));

  return Array.from(current.entries())
    .map(([district, rows]) => {
      const prev = previous.get(district) ?? [];
      const avg = rows.length
        ? rows.reduce((sum, row) => sum + row.compliance_score, 0) / rows.length
        : 0;
      const prevAvg = prev.length
        ? prev.reduce((sum, row) => sum + row.compliance_score, 0) / prev.length
        : 0;
      const criticalCount = rows.filter((row) => row.risk_level === 'critical').length;
      return {
        district,
        inspectionCount: rows.length,
        avgCompliance: Math.round(avg * 10) / 10,
        trend: Math.round((avg - prevAvg) * 10) / 10,
        criticalCount,
      };
    })
    .sort(
      (a, b) =>
        (districtOrder.get(a.district) ?? 999) - (districtOrder.get(b.district) ?? 999) ||
        a.district.localeCompare(b.district),
    );
}

export function countDistrictsWithInspections(inspections: ManagementInspection[]): number {
  return new Set(inspections.map((i) => storeDistrict(i.region))).size;
}

export interface DistrictReportSummary {
  district: string;
  reportCount: number;
  avgCompliance: number | null;
  location: string;
  storeCount: number;
}

export function computeDistrictReportSummaries(
  branches: Array<{
    id: string;
    branch_name: string;
    city: string | null;
    region: string | null;
    reportCount: number;
    lastScore: number | null;
  }>,
): DistrictReportSummary[] {
  const districtOrder = new Map(KERALA_DISTRICT_NAMES.map((name, idx) => [name, idx]));
  const grouped = groupByDistrict(branches, (b) => storeDistrict(b.region));
  return Array.from(grouped.entries())
    .map(([district, stores]) => {
      const scored = stores.filter((s) => s.lastScore !== null);
      const avgCompliance = scored.length
        ? scored.reduce((sum, s) => sum + (s.lastScore ?? 0), 0) / scored.length
        : null;
      return {
        district,
        reportCount: stores.reduce((sum, s) => sum + s.reportCount, 0),
        avgCompliance,
        location: district,
        storeCount: stores.length,
      };
    })
    .sort(
      (a, b) =>
        (districtOrder.get(a.district) ?? 999) - (districtOrder.get(b.district) ?? 999) ||
        a.district.localeCompare(b.district),
    );
}

export interface DistrictAttentionRow {
  district: string;
  avgCompliance: number;
  storeCount: number;
  branchIds: string[];
  latitudes: number[];
  longitudes: number[];
}

export function computeDistrictAttentionRows(
  storeCards: StoreCard[],
  branchCoords: Map<string, { lat: number; lng: number; branchId: string }>,
): DistrictAttentionRow[] {
  const grouped = groupByDistrict(storeCards, (s) => storeDistrict(s.region));
  return Array.from(grouped.entries())
    .map(([district, stores]) => {
      const coords = stores
        .map((s) => branchCoords.get(s.id))
        .filter((c): c is { lat: number; lng: number; branchId: string } => !!c);
      return {
        district,
        avgCompliance: calcDistrictCompliance(stores),
        storeCount: stores.length,
        branchIds: stores.map((s) => s.id),
        latitudes: coords.map((c) => c.lat),
        longitudes: coords.map((c) => c.lng),
      };
    })
    .sort((a, b) => a.avgCompliance - b.avgCompliance);
}

export function countDistrictHealthBuckets(storeCards: StoreCard[]) {
  const grouped = groupByDistrict(storeCards, (s) => storeDistrict(s.region));
  let critical = 0;
  let normal = 0;
  let healthy = 0;
  grouped.forEach((stores) => {
    const status = deriveDistrictHealth(stores);
    if (status === 'critical') critical += 1;
    else if (status === 'healthy') healthy += 1;
    else normal += 1;
  });
  return { critical, normal, healthy };
}

export function countStoreHealthBuckets(storeCards: StoreCard[]) {
  let critical = 0;
  let normal = 0;
  let healthy = 0;
  storeCards.forEach((store) => {
    const status = deriveStoreHealth(store);
    if (status === 'critical') critical += 1;
    else if (status === 'healthy') healthy += 1;
    else normal += 1;
  });
  return { critical, normal, healthy };
}
