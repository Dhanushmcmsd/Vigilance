import { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../lib/animations';

interface SlaTicket {
  id: string;
  ticketId: string;
  storeName: string;
  section: string;
  issue: string;
  flaggedAt: string;
  slaStatus: 'within' | 'due-soon' | 'breached';
  assignedTo: string;
}

interface SlaTableProps {
  tickets: SlaTicket[];
  onViewTicket: (ticket: SlaTicket) => void;
}

export function SlaTable({ tickets, onViewTicket }: SlaTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const totalPages = Math.ceil(tickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTickets = tickets.slice(startIndex, endIndex);

  const getSlaStatusStyle = (status: SlaTicket['slaStatus']) => {
    switch (status) {
      case 'within':
        return {
          bg: 'rgba(22,163,74,0.15)',
          border: '#16A34A',
          color: '#16A34A',
          text: 'On Track'
        };
      case 'due-soon':
        return {
          bg: 'rgba(217,119,6,0.15)',
          border: '#D97706',
          color: '#D97706',
          text: 'Due Soon'
        };
      case 'breached':
        return {
          bg: 'rgba(192,57,43,0.15)',
          border: '#C0392B',
          color: '#C0392B',
          text: 'Breached'
        };
    }
  };

  return (
    <div
      className="rounded-lg p-6 border"
      style={{
        backgroundColor: '#111118',
        borderColor: 'rgba(255,255,255,0.07)'
      }}
    >
      <h2 className="text-sm font-semibold text-text-primary mb-4">
        Escalation Tracker
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-xs uppercase tracking-wider font-semibold sticky top-0"
              style={{
                backgroundColor: '#0F172A',
                color: 'rgba(245,245,240,0.7)',
                borderBottom: '2px solid rgba(37,99,235,0.2)',
              }}
            >
              <th className="py-4 px-4 text-left">Ticket</th>
              <th className="py-4 px-4 text-left">Store</th>
              <th className="py-4 px-4 text-left">Section</th>
              <th className="py-4 px-4 text-left">Issue</th>
              <th className="py-4 px-4 text-left">Flagged At</th>
              <th className="py-4 px-4 text-left">Status</th>
              <th className="py-4 px-4 text-left">Assigned To</th>
              <th className="py-4 px-4 text-left">View</th>
            </tr>
          </thead>
          <tbody>
            {currentTickets.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-sm text-muted">
                  No escalation tickets in the current period.
                </td>
              </tr>
            )}
            {currentTickets.map((ticket, idx) => {
              const slaStyle = getSlaStatusStyle(ticket.slaStatus);

              return (
                <motion.tr
                  key={ticket.id}
                  variants={fadeUp}
                  data-cursor="pointer"
                  data-risk={ticket.slaStatus === 'breached' ? 'red' : undefined}
                  className="border-b transition-all"
                  style={{
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    borderColor: 'rgba(255,255,255,0.05)',
                  }}
                  whileHover={{
                    backgroundColor: 'rgba(37,99,235,0.08)',
                  }}
                >
                  <td className="py-4 px-4 font-mono text-xs text-text-primary">
                    {ticket.ticketId}
                  </td>
                  <td className="py-4 px-4 text-text-primary font-medium">
                    {ticket.storeName}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div
                      className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold max-w-[180px] truncate"
                      style={{
                        backgroundColor: 'rgba(37,99,235,0.2)',
                        color: '#3B82F6',
                      }}
                      title={ticket.section}
                    >
                      {ticket.section}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-muted max-w-xs truncate">
                    {ticket.issue}
                  </td>
                  <td className="py-4 px-4 font-mono text-xs text-muted">
                    {ticket.flaggedAt}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className="inline-block px-2.5 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: slaStyle.bg,
                        border: `1px solid ${slaStyle.border}`,
                        color: slaStyle.color,
                      }}
                    >
                      {slaStyle.text}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-muted">
                    {ticket.assignedTo}
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => onViewTicket(ticket)}
                      data-cursor="pointer"
                      className="text-xs font-semibold transition-colors px-2 py-1 rounded hover:bg-blue-600/20"
                      style={{ color: '#3B82F6' }}
                    >
                      View
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            data-cursor="pointer"
            className="h-9 px-4 rounded-md font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(37,99,235,0.2)',
              color: '#F5F5F0',
              border: '1px solid rgba(37,99,235,0.3)',
            }}
          >
            Previous
          </button>

          <span className="text-xs font-medium text-gray-400">
            Page <span className="font-bold text-gray-300">{currentPage}</span> of <span className="font-bold text-gray-300">{totalPages}</span>
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            data-cursor="pointer"
            className="h-9 px-4 rounded-md font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(37,99,235,0.2)',
              color: '#F5F5F0',
              border: '1px solid rgba(37,99,235,0.3)',
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
