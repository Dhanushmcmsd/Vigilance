import { supabase } from './supabase';

export type BranchLockStatus = 'available' | 'in_progress' | 'completed';

export interface BranchLockInfo {
  status: BranchLockStatus;
  officerName?: string;
  inspectionId?: string;
  officerId?: string;
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
  }>,
  currentOfficerRolesId: string | null,
): BranchLockMap {
  const map: BranchLockMap = {};
  for (const row of rows) {
    const isFinal = FINAL_STATUSES.has(row.status);
    const isOwn = row.officer_id === currentOfficerRolesId;
    const existing = map[row.branch_id];

    if (isFinal) {
      map[row.branch_id] = {
        status: 'completed',
        officerName: row.officer_name,
        inspectionId: row.inspection_id,
        officerId: row.officer_id,
      };
      continue;
    }

    if (row.status === 'draft' && !isOwn) {
      if (existing?.status !== 'completed') {
        map[row.branch_id] = {
          status: 'in_progress',
          officerName: row.officer_name,
          officerId: row.officer_id,
          inspectionId: row.inspection_id,
        };
      }
      continue;
    }

    if (row.status === 'draft' && isOwn) {
      if (!existing || existing.status === 'available') {
        map[row.branch_id] = {
          status: 'available',
          inspectionId: row.inspection_id,
          officerId: row.officer_id,
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
    console.warn('[branchLocks] fetch failed', error.message);
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

export function lockLabel(info?: BranchLockInfo, hasOwnDraft?: boolean): string | undefined {
  if (!info || info.status === 'available') {
    return hasOwnDraft ? 'Resume inspection' : undefined;
  }
  if (info.status === 'completed') return 'Report completed';
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
