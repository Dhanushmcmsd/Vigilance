import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import type { ManagementInspection } from '../../lib/inspectionQueries';
import {
  computeRisksResolvedItemsForStore,
  computeRisksResolvedStoreSummaries,
} from '../../lib/kpiDetailData';

interface RisksResolvedDetailModalProps {
  open: boolean;
  inspections: ManagementInspection[];
  district?: string | null;
  onClose: () => void;
}

export function RisksResolvedDetailModal({
  open,
  inspections,
  district,
  onClose,
}: RisksResolvedDetailModalProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSelectedBranchId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedBranchId) setSelectedBranchId(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, selectedBranchId]);

  const storeSummaries = useMemo(
    () => computeRisksResolvedStoreSummaries(inspections, district),
    [inspections, district],
  );

  const selectedStore = useMemo(
    () => storeSummaries.find((s) => s.branchId === selectedBranchId) ?? null,
    [storeSummaries, selectedBranchId],
  );

  const resolvedItems = useMemo(() => {
    if (!selectedBranchId) return [];
    return computeRisksResolvedItemsForStore(inspections, selectedBranchId, district);
  }, [inspections, selectedBranchId, district]);

  if (!open) return null;

  return createPortal(
    <div
      className="kpi-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Risks Resolved"
      onClick={onClose}
    >
      <div className="kpi-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="kpi-modal-header">
          <div className="flex items-center gap-2 min-w-0">
            {selectedBranchId ? (
              <button
                type="button"
                onClick={() => setSelectedBranchId(null)}
                className="kpi-modal-close shrink-0"
                aria-label="Back to stores"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <h2 className="kpi-modal-title truncate">
              {selectedStore
                ? `${selectedStore.storeName} — Resolved Items`
                : 'Risks Resolved — Stores'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="kpi-modal-close" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="kpi-modal-body">
          {!selectedBranchId ? (
            storeSummaries.length === 0 ? (
              <p className="kpi-modal-empty">No risks resolved this month yet.</p>
            ) : (
              <ul className="kpi-modal-list">
                {storeSummaries.map((store) => (
                  <li key={store.branchId}>
                    <button
                      type="button"
                      className="kpi-modal-row w-full text-left"
                      onClick={() => setSelectedBranchId(store.branchId)}
                    >
                      <div className="kpi-modal-row-main">
                        <p className="kpi-modal-row-primary">{store.storeName}</p>
                        <p className="kpi-modal-row-secondary">{store.district}</p>
                        <p className="kpi-modal-row-meta">
                          {store.resolvedCount} item{store.resolvedCount === 1 ? '' : 's'} resolved
                        </p>
                      </div>
                      <span className="kpi-modal-badge">{store.latestDate}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : resolvedItems.length === 0 ? (
            <p className="kpi-modal-empty">No resolved items for this store.</p>
          ) : (
            <ul className="kpi-modal-list">
              {resolvedItems.map((item) => (
                <li key={item.id} className="kpi-modal-row">
                  <div className="kpi-modal-row-main">
                    <p className="kpi-modal-row-primary">{item.itemText}</p>
                    <p className="kpi-modal-row-secondary">{item.section}</p>
                    <p className="kpi-modal-row-meta">Previously flagged · now compliant</p>
                  </div>
                  <span className="kpi-modal-badge kpi-modal-badge-safe">{item.inspectionDate}</span>
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
