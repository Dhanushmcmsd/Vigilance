import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { StoreGrid } from '../../components/dashboard/StoreGrid';
import { StoreDetailPanel, type StoreCardSummary } from '../../components/dashboard/StoreDetailPanel';
import { CeoDataState } from '../../components/dashboard/CeoDataState';
import { useCeoDashboard } from '../../context/CeoDashboardContext';
import type { CeoOutletContext } from './CeoDashboardLayout';

export default function CeoStoresPage() {
  const { storeCards, alerts, isLoading } = useCeoDashboard();
  const navigate = useNavigate();
  const { setSelectedAlert } = useOutletContext<CeoOutletContext>();
  const [selectedStore, setSelectedStore] = useState<StoreCardSummary | null>(null);

  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Store health overview</h1>
      <CeoDataState
        isLoading={isLoading}
        isEmpty={!isLoading && storeCards.length === 0}
        emptyMessage="No store inspection data in the selected period."
      >
        <StoreGrid stores={storeCards} onStoreClick={setSelectedStore} />
      </CeoDataState>

      <StoreDetailPanel
        store={selectedStore}
        onClose={() => setSelectedStore(null)}
        onViewAlerts={
          selectedStore
            ? () => {
                const storeName = selectedStore.name;
                const firstAlert = alerts.find((a) => a.storeName === storeName);
                setSelectedStore(null);
                if (firstAlert) {
                  setSelectedAlert(firstAlert);
                } else {
                  navigate(`/dashboard/alerts?store=${encodeURIComponent(storeName)}`);
                }
              }
            : undefined
        }
      />
    </div>
  );
}
