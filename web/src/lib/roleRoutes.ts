/** Default landing path after sign-in for each dashboard role. */
export const ROLE_HOME: Record<string, string> = {
  head: '/head',
  management: '/dashboard',
  admin: '/admin',
};

export function homePathForRole(role: string | null | undefined): string | null {
  if (!role) return null;
  return ROLE_HOME[role] ?? null;
}
