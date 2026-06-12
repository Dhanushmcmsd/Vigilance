import type { ManagementInspection } from './inspectionQueries';
import { isViolationResponse } from './checklistScoring';
import { storeDistrict } from './districtCalculations';
import { KERALA_DISTRICT_NAMES } from './storeRegions';

export type ComplianceTrendDirection = 'up' | 'down' | 'stable';

export interface DistrictMonthSummaryV2 {
  district: string;
  totalReports: number;
  avgCompliance: number;
  criticalStores: number;
  officersActive: number;
  redFlagsRaised: number;
  yellowFlagsRaised: number;
  mostCommonFailedSection: string;
  lastReportDate: string;
  complianceTrend: ComplianceTrendDirection;
}

export interface MonthlyArchiveStats {
  reportsSubmitted: { value: number; trend: number };
  avgCompliance: { value: number; trend: number };
  criticalFlagsRaised: { value: number; trend: number };
  activeOfficers: { value: number; districtCount: number };
}

export interface DistrictReportRow {
  id: string;
  storeName: string;
  officerName: string;
  submittedAt: string;
  complianceScore: number;
  redFlags: number;
  yellowFlags: number;
}

const trendPercent = (current: number, previous: number) => {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return Math.round(((current - previous) / previous) * 100);
};

function countRedFlags(inspection: ManagementInspection): number {
  return inspection.responses.filter(
    (r) => r.risk_level === 'RED' && isViolationResponse(r.response, r.trigger_on_no),
  ).length;
}

function countYellowFlags(inspection: ManagementInspection): number {
  return inspection.responses.filter(
    (r) => r.risk_level === 'YELLOW' && isViolationResponse(r.response, r.trigger_on_no),
  ).length;
}

function failedSections(inspection: ManagementInspection): string[] {
  const sections = new Set<string>();
  inspection.responses
    .filter((r) => isViolationResponse(r.response, r.trigger_on_no))
    .forEach((r) => sections.add(r.section));
  return Array.from(sections);
}

function trendDirection(current: number, previous: number): ComplianceTrendDirection {
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

function mostCommonSection(reports: ManagementInspection[]): string {
  const counts = new Map<string, number>();
  reports.forEach((report) => {
    failedSections(report).forEach((section) => {
      counts.set(section, (counts.get(section) ?? 0) + 1);
    });
  });
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} ×${top[1]}` : '—';
}

export function computeMonthlyArchiveStats(
  current: ManagementInspection[],
  previous: ManagementInspection[],
  districtFilter?: string | null,
): MonthlyArchiveStats {
  const scoped = districtFilter
    ? (list: ManagementInspection[]) => list.filter((i) => storeDistrict(i.region) === districtFilter)
    : (list: ManagementInspection[]) => list;

  const cur = scoped(current);
  const prev = scoped(previous);

  const redFlags = (list: ManagementInspection[]) =>
    list.reduce((sum, i) => sum + countRedFlags(i), 0);

  const avg = (list: ManagementInspection[]) =>
    list.length ? list.reduce((s, i) => s + i.compliance_score, 0) / list.length : 0;

  const officers = (list: ManagementInspection[]) => new Set(list.map((i) => i.officer_name)).size;
  const districts = new Set(cur.map((i) => storeDistrict(i.region))).size;

  return {
    reportsSubmitted: { value: cur.length, trend: trendPercent(cur.length, prev.length) },
    avgCompliance: { value: avg(cur), trend: trendPercent(avg(cur), avg(prev)) },
    criticalFlagsRaised: { value: redFlags(cur), trend: trendPercent(redFlags(cur), redFlags(prev)) },
    activeOfficers: { value: officers(cur), districtCount: districts },
  };
}

export function computeDistrictMonthSummariesV2(
  monthInspections: ManagementInspection[],
  prevMonthInspections: ManagementInspection[],
): DistrictMonthSummaryV2[] {
  const districtOrder = new Map(KERALA_DISTRICT_NAMES.map((name, idx) => [name, idx]));
  const current = new Map<string, ManagementInspection[]>();
  const previous = new Map<string, ManagementInspection[]>();

  monthInspections.forEach((row) => {
    const district = storeDistrict(row.region);
    const list = current.get(district) ?? [];
    list.push(row);
    current.set(district, list);
  });

  prevMonthInspections.forEach((row) => {
    const district = storeDistrict(row.region);
    const list = previous.get(district) ?? [];
    list.push(row);
    previous.set(district, list);
  });

  return Array.from(current.entries())
    .map(([district, reports]) => {
      const prev = previous.get(district) ?? [];
      const avg =
        reports.length
          ? reports.reduce((sum, row) => sum + row.compliance_score, 0) / reports.length
          : 0;
      const prevAvg =
        prev.length
          ? prev.reduce((sum, row) => sum + row.compliance_score, 0) / prev.length
          : 0;

      const storesWithRed = new Set(
        reports.filter((r) => countRedFlags(r) > 0).map((r) => r.branch_id),
      );

      const lastSubmitted = reports
        .slice()
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]
        ?.submitted_at;

      return {
        district,
        totalReports: reports.length,
        avgCompliance: Math.round(avg * 10) / 10,
        criticalStores: storesWithRed.size,
        officersActive: new Set(reports.map((r) => r.officer_name)).size,
        redFlagsRaised: reports.reduce((sum, r) => sum + countRedFlags(r), 0),
        yellowFlagsRaised: reports.reduce((sum, r) => sum + countYellowFlags(r), 0),
        mostCommonFailedSection: mostCommonSection(reports),
        lastReportDate: lastSubmitted
          ? new Date(lastSubmitted).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
          : '—',
        complianceTrend: trendDirection(avg, prevAvg),
      };
    })
    .sort(
      (a, b) =>
        (districtOrder.get(a.district) ?? 999) - (districtOrder.get(b.district) ?? 999) ||
        a.district.localeCompare(b.district),
    );
}

export function computeDistrictReportsList(
  inspections: ManagementInspection[],
  district: string,
): DistrictReportRow[] {
  return inspections
    .filter((i) => storeDistrict(i.region) === district)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    .map((i) => ({
      id: i.id,
      storeName: i.branch_name,
      officerName: i.officer_name,
      submittedAt: i.submitted_at,
      complianceScore: i.compliance_score,
      redFlags: countRedFlags(i),
      yellowFlags: countYellowFlags(i),
    }));
}

export function computeDistrictReportSummaryBar(reports: DistrictReportRow[]) {
  const avg =
    reports.length
      ? reports.reduce((sum, r) => sum + r.complianceScore, 0) / reports.length
      : 0;
  const redFlags = reports.reduce((sum, r) => sum + r.redFlags, 0);
  const officers = new Set(reports.map((r) => r.officerName)).size;
  return {
    reportCount: reports.length,
    avgCompliance: Math.round(avg * 10) / 10,
    redFlags,
    officers,
  };
}

export function complianceScoreColor(score: number): string {
  if (score >= 80) return '#16A34A';
  if (score >= 60) return '#D97706';
  return '#C0392B';
}
