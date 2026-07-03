import type { LucideIcon } from 'lucide-react';
import { Users, Inbox, ListChecks, Building2, BarChart3 } from 'lucide-react';

export type AdminTab = 'users' | 'account-requests' | 'checklists' | 'branches' | 'reports';

export interface AdminTabItem {
  key: AdminTab;
  label: string;
  icon: LucideIcon;
}

export const ADMIN_TABS: AdminTabItem[] = [
  { key: 'users', label: 'Users', icon: Users },
  { key: 'account-requests', label: 'Requests', icon: Inbox },
  { key: 'checklists', label: 'Checklists', icon: ListChecks },
  { key: 'branches', label: 'Branches', icon: Building2 },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
];

export function adminTabPath(tab: AdminTab) {
  return `/admin?tab=${tab}`;
}

export function parseAdminTab(value: string | null): AdminTab {
  if (value && ADMIN_TABS.some((t) => t.key === value)) return value as AdminTab;
  return 'users';
}

export function adminTabLabel(tab: AdminTab, pendingRequests = 0) {
  if (tab === 'account-requests' && pendingRequests > 0) {
    return `Requests (${pendingRequests})`;
  }
  return ADMIN_TABS.find((t) => t.key === tab)?.label ?? 'Users';
}
