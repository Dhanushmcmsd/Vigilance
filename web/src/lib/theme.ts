/**
 * Vigilance design system — web.
 *
 * Shares the same token contract as `mobile/lib/theme.ts`. Keep both files
 * in sync when adding tokens.
 *
 * The web app already wires HSL tokens through `index.css` for shadcn/ui
 * theming. This file exposes the same palette as plain hex values for any
 * code that needs them outside Tailwind (e.g. recharts series, PDF reports,
 * inline SVG fills).
 *
 * Elderly-first rules apply to web too — supervisors and management may use
 * the dashboard in branch back-offices on small monitors. Body text should
 * never be smaller than 14px, primary actions need a minimum 44×44px touch
 * target (web allows slightly smaller than mobile's 56dp because mouse users
 * have higher precision).
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

    chart: {
      primary: '#1e40af',
      secondary: '#0f766e',
      tertiary: '#d97706',
      quaternary: '#dc2626',
      muted: '#94a3b8',
    },
  },

  typography: {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 22,
    xl: 28,
    xxl: 34,
  },

  spacing: {
    touchTarget: 44,
    cardPadding: 24,
    screenPadding: 24,
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
