/** Shared visual tokens for the audit (read-only) mobile experience. */
export const AUDIT = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceElevated: '#334155',
  accent: '#6366f1',
  accentSoft: '#312e81',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  border: '#334155',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
} as const;

export function auditScoreColor(score: number | null): string {
  if (score === null) return AUDIT.textMuted;
  if (score >= 80) return AUDIT.success;
  if (score >= 60) return AUDIT.warning;
  return AUDIT.danger;
}
