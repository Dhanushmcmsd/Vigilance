/**
 * Accessibility constants for the Vigilance mobile app.
 *
 * The officer user base in a Kerala supermarket context includes older field
 * staff. Every screen in this app MUST honour these floors:
 *   - Body text  ≥ 16sp
 *   - Headings   ≥ 20sp
 *   - Touch targets ≥ 56×56dp
 *   - Solid, high-contrast colours (no rgba transparency on text)
 *   - No icon-only buttons — every action carries a visible label
 *
 * Importing FONT / TOUCH / COLOR from this file is the canonical way to keep
 * those floors in sync across the codebase. Do not hard-code smaller values.
 */

export const FONT = {
  xs: 14,
  body: 16,
  bodyLg: 18,
  h2: 20,
  h1: 24,
  display: 32,
} as const;

export const LINE_HEIGHT = {
  body: 24,
  h2: 28,
  h1: 32,
} as const;

export const TOUCH = {
  minHeight: 56,
  minWidth: 56,
  iconButton: 56,
  rowHeight: 64,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
} as const;

export const COLOR = {
  bg: '#f1f5f9',
  surface: '#ffffff',
  surfaceMuted: '#f9fafb',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',

  text: '#111827',
  textMuted: '#374151',
  textOnPrimary: '#ffffff',
  textOnPrimaryMuted: '#e2e8f0',

  brand: '#1e40af',
  brandStrong: '#1d4ed8',
  brandSoft: '#dbeafe',

  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',

  redRisk: '#dc2626',
  yellowRisk: '#d97706',
  greenRisk: '#16a34a',
} as const;

export type RiskColor = 'red' | 'yellow' | 'green';

export const riskPalette: Record<
  RiskColor,
  { fg: string; bg: string; border: string }
> = {
  red: { fg: '#b91c1c', bg: '#fee2e2', border: '#fecaca' },
  yellow: { fg: '#a16207', bg: '#fef3c7', border: '#fde68a' },
  green: { fg: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
};
