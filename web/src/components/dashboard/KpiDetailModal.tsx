import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface KpiDetailRow {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
  badge?: string;
}

interface KpiDetailModalProps {
  open: boolean;
  title: string;
  rows: KpiDetailRow[];
  onClose: () => void;
}

export function KpiDetailModal({ open, title, rows, onClose }: KpiDetailModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="kpi-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="kpi-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="kpi-modal-header">
          <h2 className="kpi-modal-title">{title}</h2>
          <button type="button" onClick={onClose} className="kpi-modal-close" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="kpi-modal-body">
          {rows.length === 0 ? (
            <p className="kpi-modal-empty">No records to display.</p>
          ) : (
            <ul className="kpi-modal-list">
              {rows.map((row) => (
                <li key={row.id} className="kpi-modal-row">
                  <div className="kpi-modal-row-main">
                    <p className="kpi-modal-row-primary">{row.primary}</p>
                    {row.secondary ? <p className="kpi-modal-row-secondary">{row.secondary}</p> : null}
                    {row.meta ? <p className="kpi-modal-row-meta">{row.meta}</p> : null}
                  </div>
                  {row.badge ? <span className="kpi-modal-badge">{row.badge}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
