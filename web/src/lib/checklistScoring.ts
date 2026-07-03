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

/** Mirrors public.calculate_compliance_score() — Yes/No rows only. */
export function computeInspectionComplianceScore(
  rows: Array<{
    response: string;
    triggerOnNo: boolean;
    wasPreviouslyAtRisk?: boolean;
    resolvedThisInspection?: boolean;
  }>,
): number | null {
  const scored = rows.filter((r) => r.response === 'Yes' || r.response === 'No');
  if (scored.length === 0) return null;

  let weightedCompliant = 0;
  for (const row of scored) {
    if (!isCompliantResponse(row.response, row.triggerOnNo)) continue;
    weightedCompliant +=
      row.wasPreviouslyAtRisk && row.resolvedThisInspection ? 1.1 : 1.0;
  }

  return Math.min(100, (weightedCompliant / scored.length) * 100);
}

/** Same guard as mobile checklist handleSubmit — blocks when any item unanswered. */
export function inspectionSubmitBlocked(
  itemIds: string[],
  responses: Record<string, { response: string | null }>,
): boolean {
  return itemIds.some((id) => responses[id]?.response == null);
}
