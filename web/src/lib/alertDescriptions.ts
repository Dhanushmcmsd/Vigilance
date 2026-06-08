import { isViolationResponse, type ChecklistResponse } from './checklistScoring';

/** Human-readable non-compliance text for alerts, notifications, and exports. */
export function formatNonComplianceAlert(
  itemText: string,
  response: ChecklistResponse | string | null | undefined,
  triggerOnNo: boolean,
): string {
  const item = itemText.trim();
  const resp = String(response ?? '').trim();
  if (!item) return 'Non-compliance flagged';
  if (!resp || resp === 'N/A') return item;
  if (!isViolationResponse(response, triggerOnNo)) return item;

  const lower = item.toLowerCase();

  if (resp === 'Bad') {
    if (lower.includes('cleanliness') || lower.includes('hygiene')) {
      return 'Poor cleanliness & hygiene condition';
    }
    if (lower.includes('staff behaviour') || lower.includes('staff behavior')) {
      return 'Poor staff behaviour towards customers';
    }
    return `Poor: ${item}`;
  }

  if (resp === 'Yes' || resp === 'No') {
    if (triggerOnNo && resp === 'No') {
      if (lower.includes('bills issued for all visible transactions')) {
        return 'Bills not issued for all visible transactions';
      }
      if (/\bmaintained\b/.test(lower)) {
        return item.replace(/\bmaintained\b/i, 'not maintained');
      }
      if (/\bfunctioning smoothly\b/.test(lower)) {
        return item.replace(/\bfunctioning smoothly\b/i, 'not functioning smoothly');
      }
      if (/\badequately filled\b/.test(lower)) {
        return item.replace(/\badequately filled\b/i, 'not adequately filled');
      }
      if (/\bactively engaged\b/.test(lower)) {
        return item.replace(/\bactively engaged\b/i, 'not actively engaged');
      }
      if (/\bavailable at counter\b/.test(lower)) {
        return 'Bill person not available at counter';
      }
      if (/\bavailable\b/.test(lower)) {
        return item.replace(/\bavailable\b/i, 'not available');
      }
      if (/\bdisplayed\b/.test(lower)) {
        return item.replace(/\bdisplayed\b/i, 'not displayed');
      }
      if (/\baccessible\b/.test(lower)) {
        return item.replace(/\baccessible\b/i, 'not accessible');
      }
      if (/\bproper\b/.test(lower)) {
        return item.replace(/\bproper\b/i, 'not proper');
      }
      if (/\bfunctional\b/.test(lower)) {
        return item.replace(/\bfunctional\b/i, 'not functional');
      }
      if (lower.includes('uniform') || lower.includes('id card')) {
        return 'Staff not in uniform / no ID card';
      }
      if (lower.includes('customer movement')) {
        return 'No customer movement';
      }
      if (!/^no\b/.test(lower) && !/^not\b/.test(lower)) {
        const words = item.split(/\s+/);
        if (words.length <= 4) {
          return `No ${item.charAt(0).toLowerCase()}${item.slice(1)}`;
        }
      }
    }

    if (!triggerOnNo && resp === 'Yes') {
      if (lower.includes('prior complaints')) {
        return 'Prior complaints reported on this store';
      }
      if (lower.includes('manual billing')) {
        return 'Manual billing observed';
      }
      if (lower.includes('empty racks') || lower.includes('stock-out')) {
        return 'Empty racks or stock-out items present';
      }
      if (lower.includes('expired products')) {
        return 'Expired products visible on shelves';
      }
      if (lower.includes('damaged or leaking')) {
        return 'Damaged or leaking products found';
      }
      if (lower.includes('mrp tampering')) {
        return 'MRP tampering observed';
      }
      if (lower.includes('internal conflicts')) {
        return 'Internal conflicts observed among staff';
      }
      if (lower.includes('unauthorized persons')) {
        return 'Unauthorized persons in staff area';
      }
      if (lower.includes('late attendance') || lower.includes('absenteeism')) {
        return 'Late attendance or absenteeism observed';
      }
      if (lower.includes('blind spots')) {
        return 'Blind spots noticed in CCTV coverage';
      }
      if (lower.includes('suspicious activity')) {
        return 'Suspicious activity observed';
      }
      if (lower.includes('unusual activity')) {
        return 'Unusual activity observed';
      }
      if (lower.includes('local authority interference')) {
        return 'Local authority interference reported';
      }
      if (lower.includes('municipality') || lower.includes('panchayat')) {
        return 'Municipality/Panchayat issues reported';
      }
      if (lower.includes('police') || lower.includes('political interference')) {
        return 'Police/political interference reported';
      }
      if (lower.includes('closure threats') || lower.includes('disputes')) {
        return 'Closure threats or disputes reported';
      }
      if (/^any\b/.test(lower)) {
        const stripped = item.replace(/^any\s+/i, '').replace(/\?$/, '').trim();
        return stripped.charAt(0).toUpperCase() + stripped.slice(1);
      }
    }
  }

  return `${resp} — ${item}`;
}
