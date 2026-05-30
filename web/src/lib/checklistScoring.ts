export type ChecklistResponse = 'Yes' | 'No' | 'N/A' | string;

export function isViolationResponse(
  response: ChecklistResponse | null | undefined,
  triggerOnNo: boolean,
): boolean {
  if (!response || response === 'N/A') return false;
  return triggerOnNo ? response === 'No' : response === 'Yes';
}

export function isCompliantResponse(
  response: ChecklistResponse | null | undefined,
  triggerOnNo: boolean,
): boolean {
  if (!response || response === 'N/A') return false;
  return !isViolationResponse(response, triggerOnNo);
}
