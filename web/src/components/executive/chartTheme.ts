import type { CSSProperties } from 'react';

export const chartPalette = {
  cfc: '#0f766e',
  store: '#334155',
  grid: 'rgba(148, 163, 184, 0.12)',
  axis: '#94a3b8',
  target: '#059669',
  warning: '#d97706',
  critical: '#e11d48',
  risk: {
    low: '#059669',
    medium: '#d97706',
    high: '#ea580c',
    critical: '#e11d48',
    none: '#cbd5e1',
  },
} as const;

export const chartMargins = {
  line: { top: 12, right: 16, left: 0, bottom: 8 },
  bar: { top: 8, right: 16, left: 0, bottom: 8 },
  barVertical: { top: 4, right: 20, left: 4, bottom: 4 },
} as const;

export function chartTooltipStyle(): CSSProperties {
  const dark = document.documentElement.classList.contains('dark');
  return {
    borderRadius: 12,
    border: dark ? '1px solid rgba(51, 65, 85, 0.8)' : '1px solid rgba(226, 232, 240, 0.9)',
    background: dark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
    fontSize: 12,
    padding: '10px 12px',
  };
}

export const axisTick = { fontSize: 11, fill: '#94a3b8' };

export function complianceBarColor(value: number) {
  if (value >= 80) return chartPalette.target;
  if (value >= 60) return chartPalette.warning;
  return chartPalette.critical;
}

export function sectionBarColor(value: number, max: number) {
  const ratio = max ? value / max : 0;
  if (ratio > 0.65) return chartPalette.critical;
  if (ratio > 0.35) return chartPalette.warning;
  return '#64748b';
}

export function heatCellColor(intensity: number) {
  if (intensity <= 0) return 'rgb(236, 253, 245)';
  if (intensity < 0.35) return 'rgb(254, 243, 199)';
  if (intensity < 0.65) return 'rgb(254, 215, 170)';
  return 'rgb(254, 205, 211)';
}

export function heatCellColorDark(intensity: number) {
  if (intensity <= 0) return 'rgba(16, 185, 129, 0.12)';
  if (intensity < 0.35) return 'rgba(245, 158, 11, 0.28)';
  if (intensity < 0.65) return 'rgba(249, 115, 22, 0.38)';
  return 'rgba(225, 29, 72, 0.48)';
}
