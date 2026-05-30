/**
 * Audit mobile theme — aligned with the field officer visual system
 * (slate header gradient, teal accent, light cards on white surfaces).
 */
export const AUDIT = {
  bg: '#f1f5f9',
  headerFrom: '#0f172a',
  headerTo: '#0f766e',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',
  accent: '#14b8a6',
  accentBright: '#2dd4bf',
  accentSoft: '#ccfbf1',
  text: '#0f172a',
  textMuted: '#64748b',
  textOnHeader: '#f8fafc',
  textOnHeaderMuted: '#99f6e4',
  border: '#e2e8f0',
  success: '#059669',
  warning: '#d97706',
  danger: '#dc2626',
  tabBar: '#0f172a',
} as const;

export function auditScoreColor(score: number | null): string {
  if (score === null) return AUDIT.textMuted;
  if (score >= 80) return AUDIT.success;
  if (score >= 60) return AUDIT.warning;
  return AUDIT.danger;
}
