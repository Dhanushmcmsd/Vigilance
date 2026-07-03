export interface BranchAssignmentRow {
  id: string;
  region: string | null;
  assigned_officer_id: string | null;
  assigned_officer_name?: string | null;
}

/** Stores an officer may access: home-district defaults plus explicit cross-district assignments. */
export function isBranchOwnedByOfficer(
  branch: BranchAssignmentRow,
  homeDistrict: string,
  officerUserId: string | null,
): boolean {
  const region = branch.region?.trim() ?? '';
  const home = homeDistrict.trim();

  if (officerUserId) {
    if (branch.assigned_officer_id === officerUserId) return true;
    if (region === home && branch.assigned_officer_id == null) return true;
    return false;
  }

  // Officer role without linked auth account — count only unassigned home-district stores.
  return region === home && branch.assigned_officer_id == null;
}

export function countOfficerStores(
  branches: BranchAssignmentRow[],
  homeDistrict: string,
  officerUserId: string | null,
): number {
  return branches.filter((b) => isBranchOwnedByOfficer(b, homeDistrict, officerUserId)).length;
}

/** True when admin can remove this officer from the store (explicit assignment only). */
export function canRemoveOfficerFromBranch(
  branch: BranchAssignmentRow,
  officerUserId: string | null,
): boolean {
  return !!officerUserId && branch.assigned_officer_id === officerUserId;
}
