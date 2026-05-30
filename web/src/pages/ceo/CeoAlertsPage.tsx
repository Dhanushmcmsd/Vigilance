import { useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertFeed } from '../../components/dashboard/AlertFeed';
import { CeoDataState } from '../../components/dashboard/CeoDataState';
import { useCeoDashboard } from '../../context/CeoDashboardContext';
import type { CeoOutletContext } from './CeoDashboardLayout';

export default function CeoAlertsPage() {
  const { setSelectedAlert } = useOutletContext<CeoOutletContext>();
  const { alerts, isLoading } = useCeoDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const storeFilter = searchParams.get('store')?.trim() ?? '';

  const filteredAlerts = useMemo(() => {
    if (!storeFilter) return alerts;
    const needle = storeFilter.toLowerCase();
    return alerts.filter((a) => a.storeName.toLowerCase().includes(needle));
  }, [alerts, storeFilter]);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-lg font-semibold text-text-primary">Live compliance alerts</h1>
        {storeFilter && (
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="text-xs font-medium px-3 py-1.5 rounded-md"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#F5F5F0' }}
          >
            Clear store filter: {storeFilter}
          </button>
        )}
      </div>
      <CeoDataState
        isLoading={isLoading}
        isEmpty={!isLoading && filteredAlerts.length === 0}
        emptyMessage={
          storeFilter
            ? `No alerts found for “${storeFilter}” in the current period.`
            : 'No active RED or YELLOW flags in the current data window.'
        }
      >
        <AlertFeed alerts={filteredAlerts} onAlertClick={setSelectedAlert} />
      </CeoDataState>
    </div>
  );
}
