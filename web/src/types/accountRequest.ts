export type AccountRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccountRequestRow {
  id: string;
  full_name: string;
  email: string;
  designation: string | null;
  branch_hint: string | null;
  note: string | null;
  status: AccountRequestStatus;
  rejection_reason: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface AccountRequestFormValues {
  full_name: string;
  email: string;
  designation: string;
  branch_hint: string;
  note: string;
}

export interface PrefillNewUser {
  name: string;
  email: string;
  phone?: string;
  branchHint?: string;
  requestId: string;
}
