import { supabase } from './supabase';
import { isViolationResponse } from './checklistScoring';

type PreviousRiskResponse = {
  checklist_item_id: string;
  response: string | null;
  checklist_templates?: { trigger_on_no?: boolean | null } | null;
};

/** Returns checklist item IDs flagged as risk on the most recent submitted inspection for a branch. */
export async function getPreviousRiskItems(branchId: string): Promise<Set<string>> {
  const { data: prevInspection, error } = await supabase
    .from('inspections')
    .select(
      `id,
      inspection_responses (
        checklist_item_id,
        response,
        checklist_templates:checklist_item_id ( trigger_on_no )
      )`,
    )
    .eq('branch_id', branchId)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !prevInspection?.inspection_responses) return new Set();

  const riskIds = new Set<string>();
  (prevInspection.inspection_responses as PreviousRiskResponse[]).forEach((entry) => {
    const triggerOnNo = entry.checklist_templates?.trigger_on_no ?? true;
    if (isViolationResponse(entry.response, triggerOnNo)) {
      riskIds.add(entry.checklist_item_id);
    }
  });

  return riskIds;
}
