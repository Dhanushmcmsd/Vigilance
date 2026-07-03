/**
 * Vigilance design system — mobile.
 *
 * This is the single source of truth for colours, typography, spacing,
 * radius, and touch-target sizing across the mobile app.
 *
 * Elderly-first rules (Kerala supermarket field staff often skew older):
 *   - Body text  ≥ 16sp
 *   - Headings   ≥ 20sp
 *   - Touch targets ≥ 56×56dp
 *   - No transparent text — solid, WCAG-AA contrast (≥ 4.5:1) only
 *   - No icon-only buttons in primary actions
 *
 * The legacy `a11y.ts` constants (`FONT`, `TOUCH`, `COLOR`, `RADIUS`,
 * `SPACING`, `riskPalette`) are now re-exports from this file — see
 * `a11y.ts` for the shim. New code should import from `theme.ts`.
 *
 * The same token contract exists in `web/src/lib/theme.ts`. Keep both in
 * sync when adding tokens.
 */

export const theme = {
  colors: {
    primary: '#1e40af',
    primaryLight: '#3b82f6',
    primaryStrong: '#1d4ed8',
    primarySoft: '#dbeafe',

    success: '#0f766e',
    successSoft: '#dcfce7',
    warning: '#b45309',
    warningSoft: '#fef3c7',
    danger: '#dc2626',
    dangerSoft: '#fee2e2',

    surface: '#ffffff',
    surfaceMuted: '#f9fafb',
    background: '#f1f5f9',

    textPrimary: '#111827',
    textSecondary: '#374151',
    textOnPrimary: '#ffffff',
    textOnPrimaryMuted: '#e2e8f0',

    border: '#e5e7eb',
    borderStrong: '#d1d5db',

    risk: {
      red: '#dc2626',
      yellow: '#d97706',
      green: '#16a34a',
    },

    overlay: 'rgba(15, 23, 42, 0.55)',
  },

  typography: {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 22,
    xl: 28,
    xxl: 34,
  },

  lineHeight: {
    body: 24,
    h2: 28,
    h1: 32,
    display: 40,
  },

  spacing: {
    touchTarget: 56,
    cardPadding: 24,
    screenPadding: 20,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  radius: {
    card: 20,
    button: 14,
    input: 12,
    pill: 999,
    sm: 8,
    md: 12,
    lg: 16,
  },
} as const;

export type Theme = typeof theme;

export const riskPalette: Record<
  'red' | 'yellow' | 'green',
  { fg: string; bg: string; border: string }
> = {
  red: { fg: '#b91c1c', bg: '#fee2e2', border: '#fecaca' },
  yellow: { fg: '#a16207', bg: '#fef3c7', border: '#fde68a' },
  green: { fg: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
};

export type RiskColor = keyof typeof riskPalette;

export default theme;
