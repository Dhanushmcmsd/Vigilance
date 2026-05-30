export type ChecklistResponse = 'Yes' | 'No' | 'N/A' | null;

/** When true, answering "No" indicates a violation. When false, "Yes" is the violation. */
export function isViolationResponse(
  response: ChecklistResponse,
  triggerOnNo: boolean,
): boolean {
  if (!response || response === 'N/A') return false;
  return triggerOnNo ? response === 'No' : response === 'Yes';
}

export function isCompliantResponse(
  response: ChecklistResponse,
  triggerOnNo: boolean,
): boolean {
  if (!response || response === 'N/A') return false;
  return !isViolationResponse(response, triggerOnNo);
}

/** Button styling: highlight the answer that matches compliance vs violation. */
export function responseButtonColors(
  value: 'Yes' | 'No',
  selected: ChecklistResponse,
  triggerOnNo: boolean,
): { activeColor: string; activeBg: string; inactiveColor: string } {
  const violation = isViolationResponse(value, triggerOnNo);
  const active = selected === value;
  if (active) {
    return violation
      ? { activeColor: '#dc2626', activeBg: '#fee2e2', inactiveColor: '#6b7280' }
      : { activeColor: '#16a34a', activeBg: '#dcfce7', inactiveColor: '#6b7280' };
  }
  return { activeColor: '#6b7280', activeBg: '#f8fafc', inactiveColor: '#6b7280' };
}
