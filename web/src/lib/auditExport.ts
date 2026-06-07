import { supabase } from './supabase';
import type { InspectionPdfData } from '../components/InspectionPdfReport';
import type { InspectionPdfAttachment } from '../components/InspectionPdfReport';

/** Load one inspection with full checklist + per-item files for PDF export. */
export async function fetchInspectionForPdf(inspectionId: string): Promise<InspectionPdfData | null> {
  const { data: item, error } = await supabase
    .from('inspections')
    .select(`
      id,
      status,
      inspection_date,
      submitted_at,
      time_in,
      time_out,
      compliance_score,
      risk_level,
      head_comment,
      branches:branch_id ( branch_name, city, branch_types:branch_type_id ( type_name ) ),
      user_roles:officer_id ( name ),
      inspection_files ( file_url, file_name, file_type, checklist_item_id ),
      inspection_answers ( checklist_item_id, photo_url ),
      inspection_responses (
        response,
        remarks,
        checklist_item_id,
        checklist_templates:checklist_item_id (
          section,
          item_text,
          trigger_on_no,
          risk_level
        )
      ),
      general_remarks ( remark_text )
    `)
    .eq('id', inspectionId)
    .maybeSingle();

  if (error || !item) return null;

  const branch = item.branches as unknown as Record<string, unknown> | null;
  const bt = branch?.branch_types as { type_name?: string } | { type_name?: string }[] | null;
  const typeName = Array.isArray(bt) ? bt[0]?.type_name : bt?.type_name;
  const files = (item.inspection_files as Record<string, unknown>[]) ?? [];
  const answerPhotos = (item.inspection_answers as Record<string, unknown>[]) ?? [];
  const generalRemarks = (item.general_remarks as { remark_text?: string }[]) ?? [];
  const safeHttpUrl = (value: unknown): string | null => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.toString();
    } catch {
      return null;
    }
  };

  return {
    id: String(item.id),
    branchName: String(branch?.branch_name ?? 'Unknown'),
    branchType: String(typeName ?? '—'),
    officerName: String((item.user_roles as { name?: string } | null)?.name ?? '—'),
    city: String(branch?.city ?? ''),
    inspectionDate: String(item.inspection_date),
    submittedAt: item.submitted_at as string | null,
    timeIn: item.time_in as string | null,
    timeOut: item.time_out as string | null,
    complianceScore: Number(item.compliance_score ?? 0),
    riskLevel: String(item.risk_level ?? 'low'),
    status: String(item.status),
    headComment: (item.head_comment as string | null) ?? null,
    generalRemark: generalRemarks.map((r) => r.remark_text).filter(Boolean).join('\n') || null,
    responses: ((item.inspection_responses as Record<string, unknown>[]) ?? []).map((r) => {
      const ct = r.checklist_templates as Record<string, unknown> | null;
      const itemFiles = files.filter((f) => f.checklist_item_id === r.checklist_item_id);
      const itemAnswerPhotos = answerPhotos
        .filter((a) => a.checklist_item_id === r.checklist_item_id)
        .map((a) => safeHttpUrl(a.photo_url))
        .filter((url): url is string => Boolean(url))
        .map((url): InspectionPdfAttachment => ({ url, type: 'image' }));
      const itemFileAttachments: InspectionPdfAttachment[] = itemFiles.reduce<InspectionPdfAttachment[]>(
        (acc, f) => {
          const url = safeHttpUrl(f.file_url);
          if (!url) return acc;
          acc.push({
            url,
            name: f.file_name ? String(f.file_name) : undefined,
            type: f.file_type === 'image' ? 'image' : 'document',
          });
          return acc;
        },
        [],
      );
      return {
        section: String(ct?.section ?? ''),
        item_text: String(ct?.item_text ?? ''),
        response: String(r.response ?? ''),
        remarks: (r.remarks as string | null) ?? null,
        risk_level: (ct?.risk_level as 'RED' | 'YELLOW' | 'GREEN' | null) ?? null,
        trigger_on_no: Boolean(ct?.trigger_on_no ?? true),
        attachments: [
          ...itemFileAttachments,
          ...itemAnswerPhotos,
        ],
      };
    }),
    photos: files
      .filter((f) => !f.checklist_item_id && /\.(jpe?g|png|webp)$/i.test(String(f.file_url)))
      .map((f) => safeHttpUrl(f.file_url))
      .filter((url): url is string => Boolean(url))
      .map((url) => ({ url })),
  };
}
