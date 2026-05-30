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
  edited_at: string | null;
  is_edited: boolean;
  edit_count: number;
  inspection_date: string;
  branch_id: string;
  branch_name: string;
  branch_type: string;
  city: string;
  region: string;
  officer_name: string;
  officer_photo_url: string | null;
  responses: InspectionResponseRow[];
  file_count: number;
  photos: { url: string; uploaded_at: string | null; source: 'answers' | 'files' }[];
}

const INSPECTION_SELECT = `
  id,
  status,
  compliance_score,
  risk_level,
  submitted_at,
  edited_at,
  is_edited,
  edit_count,
  inspection_date,
  branch_id,
  branches:branch_id (
    branch_name,
    city,
    region,
    branch_types:branch_type_id ( type_name )
  ),
  user_roles:officer_id ( name, profile_photo_url ),
  inspection_files ( id, file_url, file_type, uploaded_at ),
  inspection_answers ( photo_url, photo_uploaded_at ),
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
  const answerPhotos = ((item.inspection_answers as Record<string, unknown>[]) ?? [])
    .filter((photo) => Boolean(photo.photo_url))
    .map((photo) => ({
      url: String(photo.photo_url),
      uploaded_at: (photo.photo_uploaded_at as string | null) ?? null,
      source: 'answers' as const,
    }));
  const filePhotos = ((item.inspection_files as Record<string, unknown>[]) ?? [])
    .filter((file) => /\.(jpe?g|png|webp)$/i.test(String(file.file_url ?? '')))
    .map((file) => ({
      url: String(file.file_url),
      uploaded_at: (file.uploaded_at as string | null) ?? null,
      source: 'files' as const,
    }));

  return {
    id: String(item.id),
    status: String(item.status),
    compliance_score: Number(item.compliance_score ?? 0),
    risk_level: String(item.risk_level ?? 'low'),
    submitted_at: String(item.submitted_at ?? item.inspection_date),
    edited_at: (item.edited_at as string | null) ?? null,
    is_edited: Boolean(item.is_edited ?? false),
    edit_count: Number(item.edit_count ?? 0),
    inspection_date: String(item.inspection_date),
    branch_id: String(item.branch_id),
    branch_name: String(branch?.branch_name ?? 'Unknown Branch'),
    branch_type: String(typeName ?? 'Unknown'),
    city: String(branch?.city ?? '—'),
    region: String(branch?.region ?? '—'),
    officer_name: String((item.user_roles as { name?: string } | null)?.name ?? 'Unknown Officer'),
    officer_photo_url: ((item.user_roles as { profile_photo_url?: string | null } | null)?.profile_photo_url) ?? null,
    responses,
    file_count: ((item.inspection_files as unknown[]) ?? []).length,
    photos: [...answerPhotos, ...filePhotos],
  };
}

/** All submitted inspections for management analytics (realtime-refreshed). */
export async function fetchManagementInspections(): Promise<ManagementInspection[]> {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const fromDate = sixMonthsAgo.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('inspections')
    .select(INSPECTION_SELECT)
    .in('status', ['submitted', 'approved', 'rejected'])
    .gte('inspection_date', fromDate)
    .order('inspection_date', { ascending: false })
    .limit(400);

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
