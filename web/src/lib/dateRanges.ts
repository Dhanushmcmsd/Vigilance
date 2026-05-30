export type RangeKey = 'today' | 'week' | 'month' | 'quarter' | 'custom';

export function getDateRange(range: RangeKey, from: string, to: string) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'quarter') {
    start.setMonth(now.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'custom' && from && to) {
    return {
      start: new Date(`${from}T00:00:00`),
      end: new Date(`${to}T23:59:59`),
    };
  }

  return { start, end };
}

export function previousPeriod(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { prevStart, prevEnd };
}

/** Prefer submitted_at so period filters match when the officer actually submitted. */
export function activityDate(item: {
  inspection_date: string;
  submitted_at?: string | null;
}): Date {
  const raw = item.submitted_at ?? item.inspection_date;
  return new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
}

export function filterByDateRange<
  T extends { inspection_date: string; submitted_at?: string | null },
>(items: T[], start: Date, end: Date): T[] {
  return items.filter((item) => {
    const date = activityDate(item);
    return date >= start && date <= end;
  });
}
