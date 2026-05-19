import { countViolations, type ManagementInspection } from './inspectionQueries';
import { isViolationResponse } from './checklistScoring';

export interface ExecutiveStats {
  total: { value: number; trend: number };
  compliance: { value: number; trend: number };
  critical: { value: number; trend: number };
  pending: { value: number; trend: number };
  cfc: { value: number; trend: number };
  store: { value: number; trend: number };
  violations: { value: number; trend: number };
  branchesCovered: { value: number; trend: number };
}

export interface UnderperformingBranch {
  branchName: string;
  type: string;
  city: string;
  region: string;
  avgCompliance: number;
  inspections: number;
  criticalCount: number;
  violationRate: number;
  lastInspected: string;
  riskLevel: string;
}

const trendPercent = (current: number, previous: number) => {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return Math.round(((current - previous) / previous) * 100);
};

const riskRank = (level: string) =>
  ['low', 'medium', 'high', 'critical'].indexOf(level);

export function computeExecutiveStats(
  current: ManagementInspection[],
  previous: ManagementInspection[],
): ExecutiveStats {
  const avg = (list: ManagementInspection[]) =>
    list.length ? list.reduce((s, i) => s + i.compliance_score, 0) / list.length : 0;

  const byType = (list: ManagementInspection[], token: string) =>
    list.filter((i) => i.branch_type.toLowerCase().includes(token));

  const violations = (list: ManagementInspection[]) =>
    list.reduce((s, i) => s + countViolations(i), 0);

  const branches = (list: ManagementInspection[]) => new Set(list.map((i) => i.branch_name)).size;

  const curCfc = byType(current, 'cfc');
  const curStore = byType(current, 'store');
  const prevCfc = byType(previous, 'cfc');
  const prevStore = byType(previous, 'store');

  return {
    total: { value: current.length, trend: trendPercent(current.length, previous.length) },
    compliance: { value: avg(current), trend: trendPercent(avg(current), avg(previous)) },
    critical: {
      value: current.filter((i) => i.risk_level === 'critical').length,
      trend: trendPercent(
        current.filter((i) => i.risk_level === 'critical').length,
        previous.filter((i) => i.risk_level === 'critical').length,
      ),
    },
    pending: {
      value: current.filter((i) => i.status === 'submitted').length,
      trend: trendPercent(
        current.filter((i) => i.status === 'submitted').length,
        previous.filter((i) => i.status === 'submitted').length,
      ),
    },
    cfc: { value: avg(curCfc), trend: trendPercent(avg(curCfc), avg(prevCfc)) },
    store: { value: avg(curStore), trend: trendPercent(avg(curStore), avg(prevStore)) },
    violations: {
      value: violations(current),
      trend: trendPercent(violations(current), violations(previous)),
    },
    branchesCovered: {
      value: branches(current),
      trend: trendPercent(branches(current), branches(previous)),
    },
  };
}

export function computeUnderperformers(
  inspections: ManagementInspection[],
  threshold = 70,
): UnderperformingBranch[] {
  const grouped = new Map<string, ManagementInspection[]>();
  inspections.forEach((item) => {
    const list = grouped.get(item.branch_name) ?? [];
    list.push(item);
    grouped.set(item.branch_name, list);
  });

  return Array.from(grouped.entries())
    .map(([branchName, items]) => {
      const latest = items.slice().sort(
        (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime(),
      )[0];
      const avgCompliance =
        items.reduce((s, i) => s + i.compliance_score, 0) / items.length;
      const criticalCount = items.filter((i) => i.risk_level === 'critical').length;
      const totalResponses = items.reduce((s, i) => s + i.responses.length, 0);
      const totalViolations = items.reduce((s, i) => s + countViolations(i), 0);
      const worstRisk = items.slice().sort((a, b) => riskRank(b.risk_level) - riskRank(a.risk_level))[0]
        ?.risk_level ?? 'low';

      return {
        branchName,
        type: latest.branch_type,
        city: latest.city,
        region: latest.region,
        avgCompliance,
        inspections: items.length,
        criticalCount,
        violationRate: totalResponses ? (totalViolations / totalResponses) * 100 : 0,
        lastInspected: latest.inspection_date,
        riskLevel: worstRisk,
      };
    })
    .filter(
      (b) =>
        b.avgCompliance < threshold ||
        b.criticalCount > 0 ||
        b.riskLevel === 'high' ||
        b.riskLevel === 'critical',
    )
    .sort((a, b) => a.avgCompliance - b.avgCompliance);
}

export function computeTopIssues(inspections: ManagementInspection[], limit = 10) {
  const counts = new Map<string, { section: string; item: string; count: number }>();
  inspections.forEach((inspection) => {
    inspection.responses
      .filter((r) => isViolationResponse(r.response, r.trigger_on_no))
      .forEach((r) => {
        const key = `${r.section}__${r.item_text}`;
        const existing = counts.get(key) ?? { section: r.section, item: r.item_text, count: 0 };
        existing.count += 1;
        counts.set(key, existing);
      });
  });

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      ...item,
      percentage: inspections.length ? (item.count / inspections.length) * 100 : 0,
    }));
}

export function computeIssuesBySection(inspections: ManagementInspection[]) {
  const counts = new Map<string, number>();
  inspections.forEach((inspection) => {
    inspection.responses
      .filter((r) => isViolationResponse(r.response, r.trigger_on_no))
      .forEach((r) => counts.set(r.section, (counts.get(r.section) ?? 0) + 1));
  });
  return Array.from(counts.entries())
    .map(([section, issues]) => ({ section, issues }))
    .sort((a, b) => b.issues - a.issues);
}

export function computeComplianceTrend(
  inspections: ManagementInspection[],
  useWeekly: boolean,
) {
  const grouped = new Map<string, { cfc: number[]; store: number[] }>();
  inspections.forEach((item) => {
    const date = new Date(item.inspection_date);
    const key = useWeekly
      ? `W${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('en-IN', { month: 'short' })}`
      : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const entry = grouped.get(key) ?? { cfc: [], store: [] };
    if (item.branch_type.toLowerCase().includes('cfc')) entry.cfc.push(item.compliance_score);
    else entry.store.push(item.compliance_score);
    grouped.set(key, entry);
  });

  return Array.from(grouped.entries()).map(([label, value]) => ({
    label,
    cfc: value.cfc.length ? value.cfc.reduce((a, b) => a + b, 0) / value.cfc.length : 0,
    store: value.store.length ? value.store.reduce((a, b) => a + b, 0) / value.store.length : 0,
  }));
}

export function computeBranchRows(inspections: ManagementInspection[]) {
  const grouped = new Map<string, ManagementInspection[]>();
  inspections.forEach((item) => {
    const list = grouped.get(item.branch_name) ?? [];
    list.push(item);
    grouped.set(item.branch_name, list);
  });

  return Array.from(grouped.entries()).map(([branchName, items]) => {
    const latest = items.slice().sort(
      (a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime(),
    )[0];
    return {
      branchName,
      type: latest.branch_type,
      city: latest.city,
      inspections: items.length,
      avgCompliance: items.reduce((s, i) => s + i.compliance_score, 0) / items.length,
      riskLevel: items.slice().sort((a, b) => riskRank(b.risk_level) - riskRank(a.risk_level))[0]
        ?.risk_level ?? 'low',
      lastInspected: new Date(latest.inspection_date).toLocaleDateString('en-IN'),
    };
  });
}
