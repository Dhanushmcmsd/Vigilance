import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { StatCard } from '../../components/dashboard/StatCard';
import { AlertFeed } from '../../components/dashboard/AlertFeed';
import { SectionRiskChart } from '../../components/dashboard/SectionRiskChart';
import { StoreGrid } from '../../components/dashboard/StoreGrid';
import { StoreDetailPanel } from '../../components/dashboard/StoreDetailPanel';
import { useCeoDashboard } from '../../context/CeoDashboardContext';
import { staggerContainer, fadeUp } from '../../lib/animations';
import {
  computeDistrictCards,
  computeScopedMetrics,
  computeScopedSectionData,
  filterInspectionsByDistrict,
  storeDistrict,
} from '../../lib/districtCalculations';
import { sortStoresByRecency } from '../../lib/utils';
import { computeAlertFeed } from '../../lib/ceoDashboardData';
import type { CeoOutletContext } from './CeoDashboardLayout';

export default function CeoOverviewPage() {
  const { setSelectedAlert } = useOutletContext<CeoOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDistrict = searchParams.get('district');
  const [selectedStore, setSelectedStore] = useState<ReturnType<typeof useCeoDashboard>['storeCards'][0] | null>(null);

  const { inspections, redAlerts, sectionData, storeCards, isLoading } = useCeoDashboard();

  const districtCards = useMemo(() => computeDistrictCards(storeCards), [storeCards]);

  const scopedMetrics = useMemo(
    () => computeScopedMetrics(inspections, storeCards, selectedDistrict),
    [inspections, storeCards, selectedDistrict],
  );

  const scopedSectionData = useMemo(
    () => (selectedDistrict ? computeScopedSectionData(inspections, selectedDistrict) : sectionData),
    [inspections, selectedDistrict, sectionData],
  );

  const scopedAlerts = useMemo(() => {
    const alerts = selectedDistrict
      ? computeAlertFeed(filterInspectionsByDistrict(inspections, selectedDistrict)).filter(
          (a) => a.risk === 'RED',
        )
      : redAlerts;
    return alerts;
  }, [inspections, redAlerts, selectedDistrict]);

  const gridStores = useMemo(() => {
    if (selectedDistrict) {
      const scoped = storeCards.filter((s) => storeDistrict(s.region) === selectedDistrict);
      return sortStoresByRecency(scoped);
    }
    return districtCards;
  }, [selectedDistrict, storeCards, districtCards]);

  const openDistrict = (district: string) => {
    setSearchParams({ district });
  };

  const goBackToDistricts = () => {
    setSearchParams({});
    setSelectedStore(null);
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8 max-w-[1600px]">
      {selectedDistrict ? (
        <button
          type="button"
          onClick={goBackToDistricts}
          className="text-sm text-muted hover:text-text-primary transition-colors min-h-[44px] px-1"
        >
          ← Back to Districts
        </button>
      ) : null}

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard label="Open RED Flags" value={scopedMetrics.openRedFlags} borderColor="critical" loading={isLoading} />
        <StatCard
          label="Stores at Critical Risk"
          value={scopedMetrics.storesAtCriticalRisk}
          borderColor="critical"
          loading={isLoading}
        />
        <StatCard label="Breaches" value={scopedMetrics.slaBreaches} borderColor="critical" loading={isLoading} />
        <StatCard
          label="Active Yellow Warnings"
          value={scopedMetrics.activeYellowWarnings}
          borderColor="warning"
          loading={isLoading}
        />
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4">
        <StatCard label="Inspections Today" value={scopedMetrics.inspectionsToday} loading={isLoading} />
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AlertFeed
            alerts={scopedAlerts}
            onAlertClick={setSelectedAlert}
            groupByDistrict={!selectedDistrict}
          />
        </div>
        <div className="lg:col-span-1">
          <SectionRiskChart data={scopedSectionData} />
        </div>
      </motion.div>

      <motion.div variants={fadeUp}>
        <StoreGrid
          stores={gridStores.slice(0, selectedDistrict ? gridStores.length : 9)}
          onStoreClick={(store) => {
            if (selectedDistrict) {
              setSelectedStore(store);
            } else {
              openDistrict(store.name);
            }
          }}
        />
      </motion.div>

      <StoreDetailPanel store={selectedStore} onClose={() => setSelectedStore(null)} />
    </motion.div>
  );
}
