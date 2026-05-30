import { useOutletContext } from 'react-router-dom';
import { SlaTable } from '../../components/dashboard/SlaTable';
import { CeoDataState } from '../../components/dashboard/CeoDataState';
import { useCeoDashboard } from '../../context/CeoDashboardContext';
import type { CeoOutletContext } from './CeoDashboardLayout';

export default function CeoEscalationsPage() {
  const { setSelectedAlert } = useOutletContext<CeoOutletContext>();
  const { slaTickets, alerts, isLoading } = useCeoDashboard();

  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Escalation SLA tracker</h1>
      <CeoDataState
        isLoading={isLoading}
        isEmpty={!isLoading && slaTickets.length === 0}
        emptyMessage="No open RED escalations requiring SLA tracking."
      >
        <SlaTable
          tickets={slaTickets}
          onViewTicket={(ticket) => {
            const match = alerts.find((a) => a.id === ticket.id);
            if (match) setSelectedAlert(match);
          }}
        />
      </CeoDataState>
    </div>
  );
}
