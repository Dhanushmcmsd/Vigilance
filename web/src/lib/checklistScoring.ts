export type ChecklistResponse = 'Yes' | 'No' | 'N/A' | 'Good' | 'Moderate' | 'Bad' | null;

/** When true, answering "No" indicates a violation. When false, "Yes" is the violation. */
export function isViolationResponse(
  response: ChecklistResponse | string | null | undefined,
  triggerOnNo: boolean,
): boolean {
  if (!response || response === 'N/A') return false;
  if (response === 'Bad') return true;
  if (response === 'Good' || response === 'Moderate') return false;
  if (response === 'Yes' || response === 'No') {
    return triggerOnNo ? response === 'No' : response === 'Yes';
  }
  return false;
}

export function isCompliantResponse(
  response: ChecklistResponse | string | null | undefined,
  triggerOnNo: boolean,
): boolean {
  if (!response || response === 'N/A') return false;
  return !isViolationResponse(response, triggerOnNo);
}
