/** Types and grouping helpers for audit report browsing. */

export interface AuditReportRow {
  id: string;
  inspection_date: string;
  submitted_at: string | null;
  status: string;
  compliance_score: number | null;
  risk_level: string | null;
  officer: { name: string } | null;
}

export interface AuditMonthFolder {
  /** `YYYY-MM` */
  key: string;
  label: string;
  reportCount: number;
}

export interface AuditStoreReportGroups {
  currentMonthLabel: string;
  currentMonthDays: AuditReportRow[];
  monthFolders: AuditMonthFolder[];
}

function parseYmd(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function reportSortTime(report: AuditReportRow): number {
  return new Date(report.submitted_at ?? report.inspection_date).getTime();
}

/** Inspections in the current calendar month, grouped by day (newest first). */
export function groupStoreReports(reports: AuditReportRow[], now = new Date()): AuditStoreReportGroups {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentMonthLabel = monthLabel(currentYear, currentMonth);

  const currentMonthDays: AuditReportRow[] = [];
  const folderCounts = new Map<string, { year: number; month: number; count: number }>();

  for (const row of reports) {
    const { year, month } = parseYmd(row.inspection_date);
    if (year === currentYear && month === currentMonth) {
      currentMonthDays.push(row);
    } else {
      const key = monthKey(year, month);
      const existing = folderCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        folderCounts.set(key, { year, month, count: 1 });
      }
    }
  }

  currentMonthDays.sort((a, b) => reportSortTime(b) - reportSortTime(a));

  const monthFolders: AuditMonthFolder[] = [...folderCounts.entries()]
    .map(([key, { year, month, count }]) => ({
      key,
      label: monthLabel(year, month),
      reportCount: count,
    }))
    .sort((a, b) => b.key.localeCompare(a.key));

  return { currentMonthLabel, currentMonthDays, monthFolders };
}

export function formatReportDayLine(dateStr: string): { weekday: string; dateLine: string } {
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'long' }),
    dateLine: d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}

export function reportsInMonth(
  reports: AuditReportRow[],
  yearMonth: string,
): AuditReportRow[] {
  return reports
    .filter((r) => r.inspection_date.startsWith(yearMonth))
    .sort((a, b) => reportSortTime(b) - reportSortTime(a));
}

export function monthFolderLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return monthLabel(y, m - 1);
}
