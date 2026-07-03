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
  const grouped = new Map<string, Map<string, number[]>>();
  const regions = new Set<string>();

  inspections.forEach((item) => {
    const date = new Date(item.inspection_date);
    const key = useWeekly
      ? `W${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('en-IN', { month: 'short' })}`
      : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    const region = item.region || 'Unassigned';
    regions.add(region);

    const entry = grouped.get(key) ?? new Map<string, number[]>();
    const scores = entry.get(region) ?? [];
    scores.push(item.compliance_score);
    entry.set(region, scores);
    grouped.set(key, entry);
  });

  const sortedKeys = Array.from(grouped.keys()).sort((a, b) => {
    const parseKey = (label: string) => {
      const match = label.match(/^W(\d+)/);
      if (match) return Number(match[1]);
      return Number(label.slice(0, 2)) || 0;
    };
    return parseKey(a) - parseKey(b);
  });

  const regionNames = Array.from(regions).sort();

  return sortedKeys.map((label) => {
    const regionMap = grouped.get(label) ?? new Map<string, number[]>();
    const values: Record<string, number | string | null> = { label };
    regionNames.forEach((region) => {
      const scores = regionMap.get(region) ?? [];
      values[region] = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    });
    return values;
  });
}

export function computeStorePerformanceTrend(
  inspections: ManagementInspection[],
  maxStores = 4,
): Array<Record<string, string | number | null>> {
  if (!inspections.length) return [];

  const storeCounts = new Map<string, number>();
  inspections.forEach((item) => {
    storeCounts.set(item.branch_name, (storeCounts.get(item.branch_name) ?? 0) + 1);
  });

  const topStores = Array.from(storeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxStores)
    .map(([name]) => name);

  const byDay = new Map<string, Map<string, number[]>>();
  inspections.forEach((item) => {
    const day = new Date(item.inspection_date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
    const dayMap = byDay.get(day) ?? new Map<string, number[]>();
    const existing = dayMap.get(item.branch_name) ?? [];
    existing.push(item.compliance_score);
    dayMap.set(item.branch_name, existing);

    const overall = dayMap.get('Overall') ?? [];
    overall.push(item.compliance_score);
    dayMap.set('Overall', overall);
    byDay.set(day, dayMap);
  });

  const orderedDays = Array.from(byDay.keys()).sort((a, b) => {
    const parse = (label: string) => {
      const [d, mon] = label.split(' ');
      const month = new Date(`${mon} 1, 2024`).getMonth();
      return month * 31 + Number(d);
    };
    return parse(a) - parse(b);
  });

  return orderedDays.map((label) => {
    const dayMap = byDay.get(label) ?? new Map<string, number[]>();
    const row: Record<string, string | number | null> = { label };
    const series = ['Overall', ...topStores];
    series.forEach((store) => {
      const scores = dayMap.get(store) ?? [];
      row[store] = scores.length
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null;
    });
    return row;
  });
}

export interface HeatmapCell {
  branch: string;
  section: string;
  violations: number;
  intensity: number;
}

export interface BranchSectionHeatmap {
  branches: string[];
  sections: string[];
  cells: HeatmapCell[];
}

export interface RiskDistributionItem {
  level: string;
  label: string;
  count: number;
}

export interface RegionalComplianceItem {
  region: string;
  compliance: number;
  inspections: number;
}

const RISK_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export function computeBranchSectionHeatmap(
  inspections: ManagementInspection[],
  maxBranches = 8,
): BranchSectionHeatmap {
  const sectionSet = new Set<string>();
  const branchMap = new Map<string, Map<string, number>>();

  inspections.forEach((inspection) => {
    const branchCounts = branchMap.get(inspection.branch_name) ?? new Map<string, number>();
    inspection.responses
      .filter((response) => isViolationResponse(response.response, response.trigger_on_no))
      .forEach((response) => {
        sectionSet.add(response.section);
        branchCounts.set(response.section, (branchCounts.get(response.section) ?? 0) + 1);
      });
    branchMap.set(inspection.branch_name, branchCounts);
  });

  const sections = Array.from(sectionSet).sort();
  const branches = Array.from(branchMap.entries())
    .sort((a, b) => {
      const totalA = [...a[1].values()].reduce((sum, value) => sum + value, 0);
      const totalB = [...b[1].values()].reduce((sum, value) => sum + value, 0);
      return totalB - totalA;
    })
    .slice(0, maxBranches)
    .map(([branchName]) => branchName);

  const maxVal = Math.max(
    1,
    ...branches.flatMap((branch) =>
      sections.map((section) => branchMap.get(branch)?.get(section) ?? 0),
    ),
  );

  const cells: HeatmapCell[] = branches.flatMap((branch) =>
    sections.map((section) => {
      const violations = branchMap.get(branch)?.get(section) ?? 0;
      return {
        branch,
        section,
        violations,
        intensity: violations / maxVal,
      };
    }),
  );

  return { branches, sections, cells };
}

export function computeRiskDistribution(
  inspections: ManagementInspection[],
): RiskDistributionItem[] {
  const counts = new Map<string, number>();
  inspections.forEach((inspection) => {
    const level = inspection.risk_level ?? 'low';
    counts.set(level, (counts.get(level) ?? 0) + 1);
  });

  return ['low', 'medium', 'high', 'critical']
    .map((level) => ({
      level,
      label: RISK_LABELS[level] ?? level,
      count: counts.get(level) ?? 0,
    }))
    .filter((item) => item.count > 0);
}

export function computeRegionalCompliance(
  inspections: ManagementInspection[],
): RegionalComplianceItem[] {
  const byRegion = new Map<string, number[]>();
  inspections.forEach((inspection) => {
    const region = inspection.region || 'Unassigned';
    const scores = byRegion.get(region) ?? [];
    scores.push(inspection.compliance_score);
    byRegion.set(region, scores);
  });

  return Array.from(byRegion.entries())
    .map(([region, scores]) => ({
      region,
      compliance: scores.reduce((sum, score) => sum + score, 0) / scores.length,
      inspections: scores.length,
    }))
    .sort((a, b) => b.compliance - a.compliance);
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
