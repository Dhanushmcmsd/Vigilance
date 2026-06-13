import { supabase } from './supabase';

export type BranchLockStatus = 'available' | 'in_progress' | 'completed';

export interface BranchLockInfo {
  status: BranchLockStatus;
  officerName?: string;
  inspectionId?: string;
  officerId?: string;
  submittedAt?: string | null;
  editWindowExpiresAt?: string | null;
}

export const EDIT_WINDOW_MS = 60 * 60 * 1000;

export function isEditWindowActive(expiresAt?: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export function editWindowRemainingMs(expiresAt?: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

export function formatEditWindowCountdown(expiresAt?: string | null): string | null {
  const ms = editWindowRemainingMs(expiresAt);
  if (ms <= 0) return null;
  const totalSec = Math.ceil(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export type BranchLockMap = Record<string, BranchLockInfo>;

const FINAL_STATUSES = new Set(['submitted', 'approved', 'rejected']);

export function mapLocks(
  rows: Array<{
    branch_id: string;
    status: string;
    officer_id: string;
    officer_name: string;
    inspection_id: string;
    submitted_at?: string | null;
    edit_window_expires_at?: string | null;
  }>,
  currentOfficerRolesId: string | null,
): BranchLockMap {
  const map: BranchLockMap = {};
  for (const row of rows) {
    const isFinal = FINAL_STATUSES.has(row.status);
    const isOwn = row.officer_id === currentOfficerRolesId;
    const existing = map[row.branch_id];
    const lockMeta = {
      officerName: row.officer_name,
      inspectionId: row.inspection_id,
      officerId: row.officer_id,
      submittedAt: row.submitted_at ?? null,
      editWindowExpiresAt: row.edit_window_expires_at ?? null,
    };

    if (isFinal) {
      map[row.branch_id] = {
        status: 'completed',
        ...lockMeta,
      };
      continue;
    }

    if (row.status === 'draft' && !isOwn) {
      if (existing?.status !== 'completed') {
        map[row.branch_id] = {
          status: 'in_progress',
          ...lockMeta,
        };
      }
      continue;
    }

    if (row.status === 'draft' && isOwn) {
      if (!existing || existing.status === 'available') {
        map[row.branch_id] = {
          status: 'available',
          ...lockMeta,
        };
      }
    }
  }
  return map;
}

export async function fetchTodayBranchLocks(
  branchTypeId: string,
  currentOfficerRolesId: string | null,
): Promise<BranchLockMap> {
  const { data, error } = await supabase.rpc('get_today_branch_locks', {
    p_branch_type_id: branchTypeId,
  });
  if (error) {
    if (__DEV__) console.warn('[branchLocks] fetch failed', error.message);
    return {};
  }
  return mapLocks((data as []) ?? [], currentOfficerRolesId);
}

export async function claimBranchInspection(branchId: string, timeIn?: string): Promise<{
  inspectionId: string | null;
  errorCode: 'BRANCH_COMPLETED' | 'BRANCH_IN_PROGRESS' | 'OFFICER_NOT_FOUND' | 'UNKNOWN' | null;
  message: string;
}> {
  const { data, error } = await supabase.rpc('claim_branch_inspection', {
    p_branch_id: branchId,
    ...(timeIn ? { p_time_in: timeIn } : {}),
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('BRANCH_COMPLETED')) {
      return { inspectionId: null, errorCode: 'BRANCH_COMPLETED', message: 'Report completed for this store today.' };
    }
    if (msg.includes('BRANCH_IN_PROGRESS')) {
      return {
        inspectionId: null,
        errorCode: 'BRANCH_IN_PROGRESS',
        message: 'Another officer is inspecting this store.',
      };
    }
    return { inspectionId: null, errorCode: 'UNKNOWN', message: msg || 'Could not start inspection.' };
  }
  return { inspectionId: data as string, errorCode: null, message: '' };
}

/**
 * Permanently deletes a submitted inspection and all its data (responses,
 * files, remarks) so the original submitting officer can refill the checklist.
 * Only the officer who submitted the inspection can call this.
 */
export async function deleteAndResetInspection(inspectionId: string): Promise<{
  success: boolean;
  errorCode: 'NOT_OWNER' | 'INSPECTION_NOT_FOUND' | 'CANNOT_REFILL_APPROVED' | 'OFFICER_NOT_FOUND' | 'UNKNOWN' | null;
  message: string;
  nextEditCount?: number;
}> {
  const { data: previousInspection } = await supabase
    .from('inspections')
    .select('edit_count')
    .eq('id', inspectionId)
    .maybeSingle();
  const nextEditCount = Number(previousInspection?.edit_count ?? 0) + 1;

  const { error } = await supabase.rpc('delete_and_reset_inspection', {
    p_inspection_id: inspectionId,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('NOT_OWNER'))
      return { success: false, errorCode: 'NOT_OWNER', message: 'Only the officer who submitted this report can refill it.' };
    if (msg.includes('INSPECTION_NOT_FOUND'))
      return { success: false, errorCode: 'INSPECTION_NOT_FOUND', message: 'Inspection not found.' };
    if (msg.includes('CANNOT_REFILL_APPROVED'))
      return { success: false, errorCode: 'CANNOT_REFILL_APPROVED', message: 'This inspection has been approved or rejected and cannot be refilled.' };
    if (msg.includes('OFFICER_NOT_FOUND'))
      return { success: false, errorCode: 'OFFICER_NOT_FOUND', message: 'Officer account not found.' };
    return { success: false, errorCode: 'UNKNOWN', message: msg || 'Could not reset inspection.' };
  }
  return { success: true, errorCode: null, message: '', nextEditCount };
}

export async function markInspectionAsEdit(
  inspectionId: string,
  editCount: number,
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from('inspections')
    .update({
      is_edited: true,
      edit_count: editCount,
    })
    .eq('id', inspectionId);

  if (error) {
    return { success: false, message: error.message || 'Could not mark inspection as edited.' };
  }

  return { success: true, message: '' };
}

/** Returns true if the current officer is the one who submitted/completed this branch today. */
export function isOwnCompletedBranch(
  info: BranchLockInfo | undefined,
  currentOfficerRolesId: string | null,
): boolean {
  return (
    info?.status === 'completed' &&
    !!currentOfficerRolesId &&
    info.officerId === currentOfficerRolesId
  );
}

export function canEditSubmittedBranch(
  info: BranchLockInfo | undefined,
  currentOfficerRolesId: string | null,
): boolean {
  return (
    isOwnCompletedBranch(info, currentOfficerRolesId) &&
    isEditWindowActive(info?.editWindowExpiresAt)
  );
}

export function canStartNewReportAfterWindow(
  info: BranchLockInfo | undefined,
  currentOfficerRolesId: string | null,
): boolean {
  return (
    isOwnCompletedBranch(info, currentOfficerRolesId) &&
    !isEditWindowActive(info?.editWindowExpiresAt)
  );
}

export function lockLabel(info?: BranchLockInfo, hasOwnDraft?: boolean): string | undefined {
  if (!info || info.status === 'available') {
    return hasOwnDraft ? 'Resume inspection' : undefined;
  }
  if (info.status === 'completed') {
    const countdown = formatEditWindowCountdown(info.editWindowExpiresAt);
    if (countdown) return `Submitted · Edit until ${countdown}`;
    return 'Report completed · New visit available';
  }
  return info.officerName ? `In progress · ${info.officerName}` : 'Inspection in progress';
}

export function isBranchSelectable(
  info: BranchLockInfo | undefined,
  allowOwnDraft: boolean,
): boolean {
  if (!info || info.status === 'available') return true;
  if (info.status === 'completed') return false;
  return allowOwnDraft;
}

/** Reopen a submitted inspection within the 1-hour edit window (keeps answers). */
export async function reopenInspectionForEdit(inspectionId: string): Promise<{
  inspectionId: string | null;
  errorCode: 'NOT_OWNER' | 'INSPECTION_NOT_FOUND' | 'EDIT_WINDOW_EXPIRED' | 'NOT_EDITABLE' | 'OFFICER_NOT_FOUND' | 'UNKNOWN' | null;
  message: string;
}> {
  const { data, error } = await supabase.rpc('reopen_inspection_for_edit', {
    p_inspection_id: inspectionId,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('NOT_OWNER'))
      return { inspectionId: null, errorCode: 'NOT_OWNER', message: 'Only the officer who submitted this report can edit it.' };
    if (msg.includes('INSPECTION_NOT_FOUND'))
      return { inspectionId: null, errorCode: 'INSPECTION_NOT_FOUND', message: 'Inspection not found.' };
    if (msg.includes('EDIT_WINDOW_EXPIRED'))
      return { inspectionId: null, errorCode: 'EDIT_WINDOW_EXPIRED', message: 'Edit window expired. Start a new report instead.' };
    if (msg.includes('NOT_EDITABLE'))
      return { inspectionId: null, errorCode: 'NOT_EDITABLE', message: 'This inspection cannot be edited.' };
    return { inspectionId: null, errorCode: 'UNKNOWN', message: msg || 'Could not reopen inspection.' };
  }
  return { inspectionId: data as string, errorCode: null, message: '' };
}
