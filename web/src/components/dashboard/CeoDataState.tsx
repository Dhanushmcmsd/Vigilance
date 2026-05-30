import type { ReactNode } from 'react';

export function CeoDataState({
  isLoading,
  isEmpty,
  emptyMessage,
  children,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="rounded-lg border p-12 flex flex-col items-center justify-center gap-3" style={{ borderColor: 'rgba(255,255,255,0.07)', backgroundColor: '#111118' }}>
        <div className="w-8 h-8 border-2 border-muted border-t-text-primary rounded-full animate-spin" />
        <p className="text-sm text-muted">Loading dashboard data…</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-lg border p-12 text-center" style={{ borderColor: 'rgba(255,255,255,0.07)', backgroundColor: '#111118' }}>
        <p className="text-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
