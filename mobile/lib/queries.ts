import { supabase } from './supabase';
import { isViolationResponse } from './checklistScoring';

type PreviousRiskResponse = {
  checklist_item_id: string;
  response: string | null;
  checklist_templates?: {
    trigger_on_no?: boolean | null;
    risk_level?: string | null;
    risk_classifications?:
      | { risk_level?: string | null; trigger_on_no?: boolean | null }
      | { risk_level?: string | null; trigger_on_no?: boolean | null }[]
      | null;
  } | null;
};

function resolveRiskLevel(entry: PreviousRiskResponse): string | null {
  const ct = entry.checklist_templates;
  if (!ct) return null;
  const rc = Array.isArray(ct.risk_classifications)
    ? ct.risk_classifications[0]
    : ct.risk_classifications;
  return (rc?.risk_level ?? ct.risk_level ?? null)?.toUpperCase() ?? null;
}

/** Returns RED (critical) checklist item IDs flagged on the most recent submitted inspection. */
export async function getPreviousRiskItems(branchId: string): Promise<Set<string>> {
  const { data: prevInspection, error } = await supabase
    .from('inspections')
    .select(
      `id,
      inspection_responses (
        checklist_item_id,
        response,
        checklist_templates:checklist_item_id (
          trigger_on_no,
          risk_level,
          risk_classifications:risk_classifications!risk_classifications_checklist_item_id_fkey (
            risk_level,
            trigger_on_no
          )
        )
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
    const riskLevel = resolveRiskLevel(entry);
    if (riskLevel !== 'RED') return;
    const triggerOnNo = entry.checklist_templates?.trigger_on_no ?? true;
    if (isViolationResponse(entry.response, triggerOnNo)) {
      riskIds.add(entry.checklist_item_id);
    }
  });

  return riskIds;
}
