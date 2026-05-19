import { supabase } from './supabase';
import { isViolationResponse } from './checklistScoring';

export interface InspectionResponseRow {
  id: string;
  section: string;
  item_text: string;
  response: string;
  remarks: string | null;
  trigger_on_no: boolean;
  risk_level: string | null;
  checklist_item_id: string;
}

export interface ManagementInspection {
  id: string;
  status: string;
  compliance_score: number;
  risk_level: string;
  submitted_at: string;
  inspection_date: string;
  branch_id: string;
  branch_name: string;
  branch_type: string;
  city: string;
  region: string;
  officer_name: string;
  responses: InspectionResponseRow[];
  file_count: number;
}

const INSPECTION_SELECT = `
  id,
  status,
  compliance_score,
  risk_level,
  submitted_at,
  inspection_date,
  branch_id,
  branches:branch_id (
    branch_name,
    city,
    region,
    branch_types:branch_type_id ( type_name )
  ),
  user_roles:officer_id ( name ),
  inspection_files ( id ),
  inspection_responses (
    id,
    response,
    remarks,
    checklist_item_id,
    checklist_templates:checklist_item_id (
      section,
      item_text,
      trigger_on_no,
      risk_level
    )
  )
`;

function mapInspectionRow(item: Record<string, unknown>): ManagementInspection {
  const branch = item.branches as Record<string, unknown> | null;
  const branchType = branch?.branch_types as Record<string, unknown> | { type_name: string }[] | null;
  const typeName = Array.isArray(branchType)
    ? branchType[0]?.type_name
    : (branchType as { type_name?: string } | null)?.type_name;

  const responses = ((item.inspection_responses as Record<string, unknown>[]) ?? []).map((r) => {
    const ct = r.checklist_templates as Record<string, unknown> | null;
    return {
      id: String(r.id),
      section: String(ct?.section ?? ''),
      item_text: String(ct?.item_text ?? ''),
      response: String(r.response ?? ''),
      remarks: (r.remarks as string | null) ?? null,
      trigger_on_no: Boolean(ct?.trigger_on_no ?? true),
      risk_level: (ct?.risk_level as string | null) ?? null,
      checklist_item_id: String(r.checklist_item_id ?? ''),
    };
  });

  return {
    id: String(item.id),
    status: String(item.status),
    compliance_score: Number(item.compliance_score ?? 0),
    risk_level: String(item.risk_level ?? 'low'),
    submitted_at: String(item.submitted_at ?? item.inspection_date),
    inspection_date: String(item.inspection_date),
    branch_id: String(item.branch_id),
    branch_name: String(branch?.branch_name ?? 'Unknown Branch'),
    branch_type: String(typeName ?? 'Unknown'),
    city: String(branch?.city ?? '—'),
    region: String(branch?.region ?? '—'),
    officer_name: String((item.user_roles as { name?: string } | null)?.name ?? 'Unknown Officer'),
    responses,
    file_count: ((item.inspection_files as unknown[]) ?? []).length,
  };
}

/** All submitted inspections for management analytics (realtime-refreshed). */
export async function fetchManagementInspections(): Promise<ManagementInspection[]> {
  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .in('status', ['submitted', 'approved', 'rejected'])
    .order('inspection_date', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapInspectionRow(row as Record<string, unknown>));
}

export function countViolations(inspection: ManagementInspection): number {
  return inspection.responses.filter((r) =>
    isViolationResponse(r.response, r.trigger_on_no),
  ).length;
}

export function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
