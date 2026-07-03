/**
 * @deprecated Import from `./theme` instead.
 *
 * This file is now a thin compatibility shim over `./theme`. The constants
 * here keep the legacy short names (`FONT`, `TOUCH`, `COLOR`, etc.) used
 * across the existing mobile screens. New code should import the canonical
 * design tokens from `./theme`:
 *
 *   import { theme } from '@/lib/theme';
 *   const color = theme.colors.primary;
 *
 * Both files share the same underlying values — `theme` is the single source
 * of truth.
 */

import { theme, riskPalette as _riskPalette, type RiskColor as _RiskColor } from './theme';

export const FONT = {
  xs: theme.typography.xs,
  body: theme.typography.sm,
  bodyLg: theme.typography.md,
  h2: 20,
  h1: 24,
  display: 32,
} as const;

export const LINE_HEIGHT = {
  body: theme.lineHeight.body,
  h2: theme.lineHeight.h2,
  h1: theme.lineHeight.h1,
} as const;

export const TOUCH = {
  minHeight: theme.spacing.touchTarget,
  minWidth: theme.spacing.touchTarget,
  iconButton: theme.spacing.touchTarget,
  rowHeight: 64,
} as const;

export const RADIUS = {
  sm: theme.radius.sm,
  md: theme.radius.md,
  lg: theme.radius.lg,
  xl: theme.radius.card,
  pill: theme.radius.pill,
} as const;

export const SPACING = {
  xs: theme.spacing.xs,
  sm: theme.spacing.sm,
  md: theme.spacing.md,
  lg: theme.spacing.lg,
  xl: theme.spacing.xl,
  '2xl': theme.spacing.xxl,
} as const;

export const COLOR = {
  bg: theme.colors.background,
  surface: theme.colors.surface,
  surfaceMuted: theme.colors.surfaceMuted,
  border: theme.colors.border,
  borderStrong: theme.colors.borderStrong,

  text: theme.colors.textPrimary,
  textMuted: theme.colors.textSecondary,
  textOnPrimary: theme.colors.textOnPrimary,
  textOnPrimaryMuted: theme.colors.textOnPrimaryMuted,

  brand: theme.colors.primary,
  brandStrong: theme.colors.primaryStrong,
  brandSoft: theme.colors.primarySoft,

  success: '#15803d',
  successSoft: theme.colors.successSoft,
  warning: theme.colors.warning,
  warningSoft: theme.colors.warningSoft,
  danger: '#b91c1c',
  dangerSoft: theme.colors.dangerSoft,

  redRisk: theme.colors.risk.red,
  yellowRisk: theme.colors.risk.yellow,
  greenRisk: theme.colors.risk.green,
} as const;

export type RiskColor = _RiskColor;
export const riskPalette = _riskPalette;
