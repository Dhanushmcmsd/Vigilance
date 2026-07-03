import { supabase } from './supabase';
import type { InspectionPdfData } from '../components/InspectionPdfReport';
import type { InspectionPdfAttachment } from '../components/InspectionPdfReport';
import {
  collectInspectionImageFiles,
  collectItemImageAttachments,
  type InspectionAnswerPhoto,
} from './inspectionMedia';
import { dedupeInspectionImageFiles, normalizeInspectionImageUrl, type InspectionImageFile } from './inspectionImages';

const INSPECTION_PDF_SELECT_FULL = `
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
`;

const INSPECTION_PDF_SELECT_MINIMAL = `
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
`;

async function queryInspectionForPdf(inspectionId: string, selectQuery: string) {
  return supabase
    .from('inspections')
    .select(selectQuery)
    .eq('id', inspectionId)
    .maybeSingle();
}

/** Load one inspection with full checklist + per-item files for PDF export. */
export async function fetchInspectionForPdf(inspectionId: string): Promise<InspectionPdfData | null> {
  let { data: item, error } = await queryInspectionForPdf(inspectionId, INSPECTION_PDF_SELECT_FULL);
  if (error) {
    // Fall back when optional nested relations fail due RLS/schema drift.
    const fallback = await queryInspectionForPdf(inspectionId, INSPECTION_PDF_SELECT_MINIMAL);
    item = fallback.data;
    error = fallback.error;
  }

  if (error || !item) return null;

  const row = item as unknown as Record<string, unknown>;
  const branch = row.branches as Record<string, unknown> | null;
  const bt = branch?.branch_types as { type_name?: string } | { type_name?: string }[] | null;
  const typeName = Array.isArray(bt) ? bt[0]?.type_name : bt?.type_name;
  const files = (row.inspection_files as Record<string, unknown>[]) ?? [];
  const answerPhotos = (row.inspection_answers as Record<string, unknown>[] | undefined) ?? [];
  const generalRemarks = (row.general_remarks as { remark_text?: string }[]) ?? [];
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
    id: String(row.id),
    branchName: String(branch?.branch_name ?? 'Unknown'),
    branchType: String(typeName ?? '—'),
    officerName: String((row.user_roles as { name?: string } | null)?.name ?? '—'),
    city: String(branch?.city ?? ''),
    inspectionDate: String(row.inspection_date),
    submittedAt: row.submitted_at as string | null,
    timeIn: row.time_in as string | null,
    timeOut: row.time_out as string | null,
    complianceScore: Number(row.compliance_score ?? 0),
    riskLevel: String(row.risk_level ?? 'low'),
    status: String(row.status),
    headComment: (row.head_comment as string | null) ?? null,
    generalRemark: generalRemarks.map((r) => r.remark_text).filter(Boolean).join('\n') || null,
    responses: ((row.inspection_responses as Record<string, unknown>[]) ?? []).map((r) => {
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
      const mergedAttachments = [...itemFileAttachments, ...itemAnswerPhotos];
      const seenAttachmentUrls = new Set<string>();
      const attachments = mergedAttachments.filter((attachment) => {
        const key = normalizeInspectionImageUrl(attachment.url);
        if (seenAttachmentUrls.has(key)) return false;
        seenAttachmentUrls.add(key);
        return true;
      });
      return {
        section: String(ct?.section ?? ''),
        item_text: String(ct?.item_text ?? ''),
        response: String(r.response ?? ''),
        remarks: (r.remarks as string | null) ?? null,
        risk_level: (ct?.risk_level as 'RED' | 'YELLOW' | 'GREEN' | null) ?? null,
        trigger_on_no: Boolean(ct?.trigger_on_no ?? true),
        attachments,
      };
    }),
    photos: dedupeInspectionImageFiles(files as unknown as InspectionImageFile[])
      .filter((f) => !f.checklist_item_id)
      .map((f) => safeHttpUrl(f.file_url))
      .filter((url): url is string => Boolean(url))
      .map((url) => ({ url })),
  };
}

/** Build PDF payload from data already shown in the management report modal (no extra fetch). */
export function buildInspectionPdfDataFromReportDetail(
  detail: {
    id: string;
    inspection_date: string;
    status: string;
    compliance_score: number | null;
    risk_level: string | null;
    head_comment: string | null;
    submitted_at: string | null;
    time_in: string | null;
    time_out: string | null;
    officer: { name: string } | null;
    inspection_responses: {
      response: string;
      remarks: string | null;
      checklist_item_id?: string;
      checklist_item: {
        item_text: string;
        section: string;
        trigger_on_no: boolean;
      } | null;
    }[];
    general_remarks: { remark_text: string }[];
    inspection_files?: InspectionImageFile[];
    inspection_answers?: InspectionAnswerPhoto[];
  },
  branchName: string,
  branchType = '—',
): InspectionPdfData {
  const files = (detail.inspection_files ?? []) as InspectionImageFile[];
  const answers = detail.inspection_answers ?? [];
  const allImages = collectInspectionImageFiles(files, answers);
  const photos = allImages.map((file) => ({
    url: file.file_url,
    name: file.file_name,
  }));

  return {
    id: detail.id,
    branchName,
    branchType,
    officerName: detail.officer?.name ?? '—',
    inspectionDate: detail.inspection_date,
    submittedAt: detail.submitted_at,
    timeIn: detail.time_in,
    timeOut: detail.time_out,
    complianceScore: Number(detail.compliance_score ?? 0),
    riskLevel: String(detail.risk_level ?? 'low'),
    status: detail.status,
    headComment: detail.head_comment,
    generalRemark:
      detail.general_remarks.map((r) => r.remark_text).filter(Boolean).join('\n') || null,
    responses: detail.inspection_responses.map((r) => {
      const itemId = r.checklist_item_id ?? '';
      const itemAttachments = itemId
        ? collectItemImageAttachments(files, answers, itemId)
        : [];
      return {
        section: r.checklist_item?.section ?? 'General',
        item_text: r.checklist_item?.item_text ?? '—',
        response: r.response,
        remarks: r.remarks,
        trigger_on_no: r.checklist_item?.trigger_on_no ?? true,
        risk_level: null,
        attachments: itemAttachments.map((file) => ({
          url: file.file_url,
          name: file.file_name,
          type: 'image' as const,
        })),
      };
    }),
    photos,
  };
}
