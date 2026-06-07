import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { StatCard } from '../../components/dashboard/StatCard';
import { AlertFeed } from '../../components/dashboard/AlertFeed';
import { SectionRiskChart } from '../../components/dashboard/SectionRiskChart';
import { SlaTable } from '../../components/dashboard/SlaTable';
import { StoreGrid } from '../../components/dashboard/StoreGrid';
import { useCeoDashboard } from '../../context/CeoDashboardContext';
import { staggerContainer, fadeUp } from '../../lib/animations';
import type { CeoOutletContext } from './CeoDashboardLayout';

export default function CeoOverviewPage() {
  const { setSelectedAlert, navigate } = useOutletContext<CeoOutletContext>();
  const { metrics, redAlerts, sectionData, slaTickets, storeCards, alerts, isLoading } = useCeoDashboard();

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8 max-w-[1600px]">
      {/* KPI Cards - 4 col on desktop, 2 col on tablet, 1 col on mobile */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard label="Open RED Flags" value={metrics.openRedFlags} borderColor="critical" loading={isLoading} />
        <StatCard
          label="Stores at Critical Risk"
          value={metrics.storesAtCriticalRisk}
          borderColor="critical"
          loading={isLoading}
        />
        <StatCard label="Breaches" value={metrics.slaBreaches} borderColor="critical" loading={isLoading} />
        <StatCard
          label="Active Yellow Warnings"
          value={metrics.activeYellowWarnings}
          borderColor="warning"
          loading={isLoading}
        />
      </motion.div>

      {/* KPI Card - Inspections Today */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-4">
        <StatCard label="Inspections Today" value={metrics.inspectionsToday} loading={isLoading} />
      </motion.div>

      {/* Alert Feed and Risk Chart - Responsive Stack */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AlertFeed alerts={redAlerts} onAlertClick={setSelectedAlert} />
        </div>
        <div className="lg:col-span-1">
          <SectionRiskChart data={sectionData} />
        </div>
      </motion.div>

      {/* SLA Table - Full width with scroll on mobile */}
      <motion.div variants={fadeUp}>
        <SlaTable
          tickets={slaTickets}
          onViewTicket={(ticket) => {
            const match = alerts.find((a) => a.id === ticket.id);
            if (match) setSelectedAlert(match);
            else navigate('/dashboard/alerts');
          }}
        />
      </motion.div>

      {/* Store Grid - Responsive 3/2/1 column */}
      <motion.div variants={fadeUp}>
        <StoreGrid
          stores={storeCards.slice(0, 9)}
          onStoreClick={() => navigate('/dashboard/stores')}
        />
      </motion.div>
    </motion.div>
  );
}
