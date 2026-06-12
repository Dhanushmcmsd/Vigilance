type Role = 'management' | 'admin' | 'officer' | 'audit';

const ROLE_LABELS: Record<Role, string> = {
  management: 'Management',
  admin: 'Administrator',
  officer: 'Field Officer',
  audit: 'Audit (read-only)',
};

const ROLE_SUBLABELS: Record<Role, string> = {
  management: 'Executive command',
  admin: 'System administration',
  officer: 'Mobile inspections',
  audit: 'Read-only reports',
};

export function roleDisplayLabel(role: Role | null | undefined): string {
  if (!role) return 'User';
  return ROLE_LABELS[role] ?? role;
}

export function roleDisplaySublabel(role: Role | null | undefined): string {
  if (!role) return '';
  return ROLE_SUBLABELS[role] ?? '';
}

export function roleInitial(name: string, role: Role | null | undefined): string {
  const fromName = name.trim().charAt(0);
  if (fromName) return fromName.toUpperCase();
  if (role) return role.charAt(0).toUpperCase();
  return 'U';
}
