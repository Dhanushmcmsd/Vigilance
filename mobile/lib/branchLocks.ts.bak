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

export async function claimBranchInspection(branchId: string): Promise<{
  inspectionId: string | null;
  errorCode: 'BRANCH_COMPLETED' | 'BRANCH_IN_PROGRESS' | 'OFFICER_NOT_FOUND' | 'UNKNOWN' | null;
  message: string;
}> {
  const { data, error } = await supabase.rpc('claim_branch_inspection', {
    p_branch_id: branchId,
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
