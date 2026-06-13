export const PRIMARY_STORE_BRANCH_TYPE_NAMES = ['Ideal Store', 'Store'] as const;

export interface BranchTypeRow {
  id: string;
  type_name: string;
}

/** Resolve the primary retail store branch type (Ideal Store in production). */
export function resolvePrimaryStoreBranchTypeId(
  branchTypes: BranchTypeRow[],
): string | undefined {
  for (const name of PRIMARY_STORE_BRANCH_TYPE_NAMES) {
    const match = branchTypes.find((bt) => bt.type_name === name);
    if (match) return match.id;
  }
  return undefined;
}
