import type { ManagementInspection } from './inspectionQueries';
import { isViolationResponse } from './checklistScoring';
import { formatNonComplianceAlert } from './alertDescriptions';
import { deriveStoreHealth, filterInspectionsByDistrict, storeDistrict, type StoreCard } from './districtCalculations';
import type { KpiDetailRow } from '../components/dashboard/KpiDetailModal';

function flagAge(submittedAt: string): string {
  const hours = Math.floor((Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function computeRedFlagDetails(
  inspections: ManagementInspection[],
  district?: string | null,
): KpiDetailRow[] {
  const scoped = filterInspectionsByDistrict(inspections, district);
  const rows: KpiDetailRow[] = [];

  scoped.forEach((inspection) => {
    inspection.responses.forEach((response) => {
      if (
        response.risk_level === 'RED' &&
        isViolationResponse(response.response, response.trigger_on_no)
      ) {
        rows.push({
          id: `${inspection.id}-${response.id}`,
          primary: inspection.branch_name,
          secondary: `${storeDistrict(inspection.region)} · ${response.section}`,
          meta: formatNonComplianceAlert(response.item_text, response.response, response.trigger_on_no),
          badge: flagAge(inspection.submitted_at),
        });
      }
    });
  });

  return rows.sort((a, b) => a.primary.localeCompare(b.primary));
}

export function computeCriticalStoreDetails(
  storeCards: StoreCard[],
  district?: string | null,
): KpiDetailRow[] {
  const scoped = district
    ? storeCards.filter((s) => storeDistrict(s.region) === district)
    : storeCards;

  return scoped
    .filter((store) => deriveStoreHealth(store) === 'critical')
    .map((store) => ({
      id: store.id,
      primary: store.name,
      secondary: storeDistrict(store.region),
      meta: `Last score: ${store.complianceScore}%`,
      badge: store.lastInspected,
    }));
}

export function computeBreachDetails(
  inspections: ManagementInspection[],
  district?: string | null,
): KpiDetailRow[] {
  const scoped = filterInspectionsByDistrict(inspections, district);
  const rows: KpiDetailRow[] = [];

  scoped.forEach((inspection) => {
    inspection.responses.forEach((response) => {
      if (
        response.risk_level === 'RED' &&
        isViolationResponse(response.response, response.trigger_on_no)
      ) {
        const hoursSince =
          (Date.now() - new Date(inspection.submitted_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince > 24) {
          rows.push({
            id: `${inspection.id}-${response.id}`,
            primary: inspection.branch_name,
            secondary: storeDistrict(inspection.region),
            meta: response.item_text,
            badge: new Date(inspection.submitted_at).toLocaleString('en-IN'),
          });
        }
      }
    });
  });

  return rows;
}

export function computeYellowWarningDetails(
  inspections: ManagementInspection[],
  district?: string | null,
): KpiDetailRow[] {
  const scoped = filterInspectionsByDistrict(inspections, district);
  const rows: KpiDetailRow[] = [];

  scoped.forEach((inspection) => {
    inspection.responses.forEach((response) => {
      if (
        response.risk_level === 'YELLOW' &&
        isViolationResponse(response.response, response.trigger_on_no)
      ) {
        const hoursSince =
          (Date.now() - new Date(inspection.submitted_at).getTime()) / (1000 * 60 * 60);
        if (hoursSince > 72) {
          rows.push({
            id: `${inspection.id}-${response.id}`,
            primary: inspection.branch_name,
            secondary: `${storeDistrict(inspection.region)} · ${response.section}`,
            meta: response.item_text,
            badge: flagAge(inspection.submitted_at),
          });
        }
      }
    });
  });

  return rows;
}

export function computeInspectionsTodayDetails(
  inspections: ManagementInspection[],
  district?: string | null,
): KpiDetailRow[] {
  const today = new Date().toISOString().split('T')[0];
  return filterInspectionsByDistrict(inspections, district)
    .filter((i) => i.inspection_date === today)
    .map((inspection) => ({
      id: inspection.id,
      primary: inspection.branch_name,
      secondary: inspection.officer_name,
      meta: storeDistrict(inspection.region),
      badge: new Date(inspection.submitted_at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
}

export function computeRisksResolvedThisMonth(
  inspections: ManagementInspection[],
  district?: string | null,
): { count: number; rows: KpiDetailRow[] } {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const scoped = filterInspectionsByDistrict(inspections, district).filter(
    (i) => new Date(i.submitted_at) >= monthStart,
  );

  const rows: KpiDetailRow[] = [];
  scoped.forEach((inspection) => {
    inspection.responses.forEach((response) => {
      if (response.was_previously_at_risk && response.resolved_this_inspection) {
        rows.push({
          id: `${inspection.id}-${response.id}`,
          primary: inspection.branch_name,
          secondary: storeDistrict(inspection.region),
          meta: response.item_text,
          badge: new Date(inspection.submitted_at).toLocaleDateString('en-IN'),
        });
      }
    });
  });

  return { count: rows.length, rows };
}

export interface ResolvedStoreSummary {
  branchId: string;
  storeName: string;
  district: string;
  resolvedCount: number;
  latestDate: string;
}

export interface ResolvedItemDetail {
  id: string;
  itemText: string;
  section: string;
  inspectionDate: string;
}

export function computeRisksResolvedStoreSummaries(
  inspections: ManagementInspection[],
  district?: string | null,
): ResolvedStoreSummary[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const scoped = filterInspectionsByDistrict(inspections, district).filter(
    (i) => new Date(i.submitted_at) >= monthStart,
  );

  const byBranch = new Map<string, ResolvedStoreSummary>();

  scoped.forEach((inspection) => {
    let resolvedInInspection = 0;
    inspection.responses.forEach((response) => {
      if (response.was_previously_at_risk && response.resolved_this_inspection) {
        resolvedInInspection += 1;
      }
    });
    if (resolvedInInspection === 0) return;

    const existing = byBranch.get(inspection.branch_id);
    const dateLabel = new Date(inspection.submitted_at).toLocaleDateString('en-IN');
    if (existing) {
      existing.resolvedCount += resolvedInInspection;
      existing.latestDate = dateLabel;
    } else {
      byBranch.set(inspection.branch_id, {
        branchId: inspection.branch_id,
        storeName: inspection.branch_name,
        district: storeDistrict(inspection.region),
        resolvedCount: resolvedInInspection,
        latestDate: dateLabel,
      });
    }
  });

  return [...byBranch.values()].sort((a, b) => a.storeName.localeCompare(b.storeName));
}

export function computeRisksResolvedItemsForStore(
  inspections: ManagementInspection[],
  branchId: string,
  district?: string | null,
): ResolvedItemDetail[] {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const scoped = filterInspectionsByDistrict(inspections, district).filter(
    (i) => i.branch_id === branchId && new Date(i.submitted_at) >= monthStart,
  );

  const rows: ResolvedItemDetail[] = [];
  scoped.forEach((inspection) => {
    inspection.responses.forEach((response) => {
      if (response.was_previously_at_risk && response.resolved_this_inspection) {
        rows.push({
          id: `${inspection.id}-${response.id}`,
          itemText: response.item_text,
          section: response.section,
          inspectionDate: new Date(inspection.submitted_at).toLocaleDateString('en-IN'),
        });
      }
    });
  });

  return rows;
}

export function computeRiskResolutionTrend(
  inspections: ManagementInspection[],
  district?: string | null,
): Array<{ month: string; newRisks: number; resolved: number; resolutionRate: number }> {
  const scoped = filterInspectionsByDistrict(inspections, district);
  const points: Array<{ month: string; newRisks: number; resolved: number; resolutionRate: number }> =
    [];

  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

    let newRisks = 0;
    let resolved = 0;

    scoped
      .filter((insp) => insp.inspection_date.startsWith(key))
      .forEach((inspection) => {
        inspection.responses.forEach((response) => {
          if (isViolationResponse(response.response, response.trigger_on_no)) {
            if (response.risk_level === 'RED' || response.risk_level === 'YELLOW') {
              newRisks += 1;
            }
          }
          const wasRisk = response.was_previously_at_risk;
          const didResolve = response.resolved_this_inspection;
          if (wasRisk && didResolve) resolved += 1;
        });
      });

    const resolutionRate = newRisks > 0 ? Math.round((resolved / newRisks) * 100) : 0;
    points.push({ month: label, newRisks, resolved, resolutionRate });
  }

  return points;
}
