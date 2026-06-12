import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StatCard } from '../../components/dashboard/StatCard';
import { SectionRiskChart } from '../../components/dashboard/SectionRiskChart';
import { StoreGrid } from '../../components/dashboard/StoreGrid';
import { StoreDetailPanel } from '../../components/dashboard/StoreDetailPanel';
import { KpiDetailModal } from '../../components/dashboard/KpiDetailModal';
import { RisksResolvedDetailModal } from '../../components/dashboard/RisksResolvedDetailModal';
import { useCeoDashboard } from '../../context/CeoDashboardContext';
import { staggerContainer, fadeUp } from '../../lib/animations';
import {
  computeDistrictCards,
  computeScopedMetrics,
  computeScopedSectionData,
  storeDistrict,
} from '../../lib/districtCalculations';
import { sortStoresByRecency } from '../../lib/utils';
import {
  computeBreachDetails,
  computeCriticalStoreDetails,
  computeInspectionsTodayDetails,
  computeRedFlagDetails,
  computeRisksResolvedThisMonth,
  computeYellowWarningDetails,
} from '../../lib/kpiDetailData';

type KpiModalKey =
  | 'redFlags'
  | 'criticalRisk'
  | 'breaches'
  | 'yellowWarnings'
  | 'inspectionsToday'
  | 'risksResolved'
  | null;

export default function CeoOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDistrict = searchParams.get('district');
  const [selectedStore, setSelectedStore] = useState<
    ReturnType<typeof useCeoDashboard>['storeCards'][0] | null
  >(null);
  const [activeKpi, setActiveKpi] = useState<KpiModalKey>(null);

  const { inspections, sectionData, storeCards, isLoading } = useCeoDashboard();

  const districtCards = useMemo(() => computeDistrictCards(storeCards), [storeCards]);

  const scopedMetrics = useMemo(
    () => computeScopedMetrics(inspections, storeCards, selectedDistrict),
    [inspections, storeCards, selectedDistrict],
  );

  const scopedSectionData = useMemo(
    () => (selectedDistrict ? computeScopedSectionData(inspections, selectedDistrict) : sectionData),
    [inspections, selectedDistrict, sectionData],
  );

  const risksResolved = useMemo(
    () => computeRisksResolvedThisMonth(inspections, selectedDistrict),
    [inspections, selectedDistrict],
  );

  const kpiModalConfig = useMemo(() => {
    switch (activeKpi) {
      case 'redFlags':
        return {
          title: 'Open RED Flags',
          rows: computeRedFlagDetails(inspections, selectedDistrict),
        };
      case 'criticalRisk':
        return {
          title: 'Stores at Critical Risk',
          rows: computeCriticalStoreDetails(storeCards, selectedDistrict),
        };
      case 'breaches':
        return { title: 'Breaches', rows: computeBreachDetails(inspections, selectedDistrict) };
      case 'yellowWarnings':
        return {
          title: 'Active Yellow Warnings',
          rows: computeYellowWarningDetails(inspections, selectedDistrict),
        };
      case 'inspectionsToday':
        return {
          title: 'Inspections Today',
          rows: computeInspectionsTodayDetails(inspections, selectedDistrict),
        };
      case 'risksResolved':
        return { title: 'Risks Resolved', rows: [] };
      default:
        return { title: '', rows: [] };
    }
  }, [activeKpi, inspections, selectedDistrict, storeCards]);

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
          className="text-sm transition-colors min-h-[44px] px-1"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Back to Districts
        </button>
      ) : null}

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Open RED Flags"
          value={scopedMetrics.openRedFlags}
          borderColor="critical"
          loading={isLoading}
          onClick={() => setActiveKpi('redFlags')}
        />
        <StatCard
          label="Stores at Critical Risk"
          value={scopedMetrics.storesAtCriticalRisk}
          borderColor="critical"
          loading={isLoading}
          onClick={() => setActiveKpi('criticalRisk')}
        />
        <StatCard
          label="Breaches"
          value={scopedMetrics.slaBreaches}
          borderColor="critical"
          loading={isLoading}
          onClick={() => setActiveKpi('breaches')}
        />
        <StatCard
          label="Active Yellow Warnings"
          value={scopedMetrics.activeYellowWarnings}
          borderColor="warning"
          loading={isLoading}
          onClick={() => setActiveKpi('yellowWarnings')}
        />
        <StatCard
          label="Risks Resolved"
          value={risksResolved.count}
          borderColor="safe"
          loading={isLoading}
          onClick={() => setActiveKpi('risksResolved')}
        />
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4">
        <StatCard
          label="Inspections Today"
          value={scopedMetrics.inspectionsToday}
          loading={isLoading}
          onClick={() => setActiveKpi('inspectionsToday')}
        />
      </motion.div>

      <motion.div variants={fadeUp}>
        <SectionRiskChart data={scopedSectionData} />
      </motion.div>

      <motion.div variants={fadeUp}>
        <StoreGrid
          stores={gridStores.slice(0, selectedDistrict ? gridStores.length : 9)}
          showDistrictLabel={!selectedDistrict}
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

      <KpiDetailModal
        open={activeKpi !== null && activeKpi !== 'risksResolved'}
        title={kpiModalConfig.title}
        rows={kpiModalConfig.rows}
        onClose={() => setActiveKpi(null)}
      />

      <RisksResolvedDetailModal
        open={activeKpi === 'risksResolved'}
        inspections={inspections}
        district={selectedDistrict}
        onClose={() => setActiveKpi(null)}
      />
    </motion.div>
  );
}
