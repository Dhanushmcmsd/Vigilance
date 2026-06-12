import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface BloomGradientPanelProps {
  children: ReactNode;
  className?: string;
  /** Lighter glass panel for nested list items inside a bloom panel */
  nested?: boolean;
  /** Skip default padding */
  noPadding?: boolean;
}

export function BloomGradientPanel({
  children,
  className,
  nested = false,
  noPadding = false,
}: BloomGradientPanelProps) {
  return (
    <div
      className={cn(
        nested ? 'bloom-panel-nested' : 'bloom-panel',
        !noPadding && (nested ? 'p-4' : 'p-5'),
        className,
      )}
    >
      <div className="bloom-panel-content">{children}</div>
    </div>
  );
}

/** Page-level typography helpers for archive/report pages on dark dashboard shell */
export function BloomPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold bloom-heading">{title}</h1>
        {description && <p className="mt-1 text-sm bloom-subtitle">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
