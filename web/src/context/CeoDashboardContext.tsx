import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useManagementInspections } from '../hooks/useManagementInspections';
import {
  computeAlertFeed,
  computeCeoMetrics,
  computeSectionBreakdown,
  computeSlaTickets,
  computeStoreCards,
} from '../lib/ceoDashboardData';
import type { ManagementInspection } from '../lib/inspectionQueries';

export interface CeoDashboardContextValue {
  inspections: ManagementInspection[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  metrics: ReturnType<typeof computeCeoMetrics>;
  alerts: ReturnType<typeof computeAlertFeed>;
  redAlerts: ReturnType<typeof computeAlertFeed>;
  sectionData: ReturnType<typeof computeSectionBreakdown>;
  slaTickets: ReturnType<typeof computeSlaTickets>;
  storeCards: ReturnType<typeof computeStoreCards>;
  notifications: {
    id: string;
    storeName: string;
    itemTitle: string;
    time: string;
    risk: 'RED' | 'YELLOW';
    read: boolean;
  }[];
}

const CeoDashboardContext = createContext<CeoDashboardContextValue | null>(null);

export function CeoDashboardProvider({ children }: { children: ReactNode }) {
  const { data: inspections = [], isLoading, isError, error, refetch } = useManagementInspections();

  const value = useMemo<CeoDashboardContextValue>(() => {
    const metrics = computeCeoMetrics(inspections);
    const alerts = computeAlertFeed(inspections);
    const redAlerts = alerts.filter((a) => a.risk === 'RED');
    const sectionData = computeSectionBreakdown(inspections);
    const slaTickets = computeSlaTickets(inspections);
    const storeCards = computeStoreCards(inspections);
    const notifications = alerts.slice(0, 20).map((alert) => ({
      id: alert.id,
      storeName: alert.storeName,
      itemTitle: alert.itemTitle,
      time: alert.timeAgo,
      risk: alert.risk,
      read: false,
    }));

    return {
      inspections,
      isLoading,
      isError,
      error: (error as Error) ?? null,
      refetch: () => void refetch(),
      metrics,
      alerts,
      redAlerts,
      sectionData,
      slaTickets,
      storeCards,
      notifications,
    };
  }, [inspections, isLoading, isError, error, refetch]);

  return <CeoDashboardContext.Provider value={value}>{children}</CeoDashboardContext.Provider>;
}

export function useCeoDashboard() {
  const ctx = useContext(CeoDashboardContext);
  if (!ctx) throw new Error('useCeoDashboard must be used within CeoDashboardProvider');
  return ctx;
}
