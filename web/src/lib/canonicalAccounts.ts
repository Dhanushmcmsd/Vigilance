/** Canonical Vigilance demo / dev login accounts. */
export const CANONICAL_ACCOUNTS = [
  {
    email: 'admin@vigilance.app',
    password: 'admin123',
    role: 'admin',
    surface: 'Web — Admin panel',
  },
  {
    email: 'management@vigilance.app',
    password: 'mgmt123',
    role: 'management',
    surface: 'Web — CEO dashboard',
  },
  {
    email: 'officer@vigilance.app',
    password: 'officer123',
    role: 'officer',
    surface: 'Mobile — Field inspections',
  },
  {
    email: 'audit@company.app',
    password: 'audit123',
    role: 'audit',
    surface: 'Mobile — Read-only audit reports',
  },
] as const;
