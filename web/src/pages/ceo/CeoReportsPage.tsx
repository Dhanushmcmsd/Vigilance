import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Calendar, Download, Calendar as CalendarIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function CeoReportsPage() {
  const { role } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportCSV = async () => {
    if (!fromDate || !toDate) {
      setExportError('Please select both start and end dates.');
      return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
      setExportError('Start date must be before end date.');
      return;
    }

    setExporting(true);
    setExportError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error('You must be signed in to export data.');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        throw new Error('Supabase is not configured.');
      }

      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const response = await fetch(`${supabaseUrl}/functions/v1/export-csv?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inspections_${fromDate}_to_${toDate}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setFromDate('');
      setToDate('');
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-50 mb-2">Reports & Archives</h1>
        <p className="text-sm text-gray-400">Dashboard / Reports</p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card 1: Audit Reports Archive */}
        <div
          className="rounded-lg border p-6 flex flex-col"
          style={{ backgroundColor: '#111118', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-start justify-between mb-4">
            <FileText className="w-8 h-8 text-blue-400 flex-shrink-0" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold text-gray-100 mb-2">Audit Reports Archive</h3>
          <p className="text-sm text-gray-400 mb-6 flex-1">
            Download historical inspection audit reports as PDF. Includes detailed compliance findings and corrective actions.
          </p>
          <Link
            to="/management/audit-archive"
            className="inline-flex items-center justify-center h-10 px-4 rounded-md font-medium text-sm transition-all"
            style={{
              backgroundColor: '#2563EB',
              color: '#F5F5F0',
            }}
          >
            Browse Archive
          </Link>
        </div>

        {/* Card 2: Monthly Compliance Archive */}
        <div
          className="rounded-lg border p-6 flex flex-col"
          style={{ backgroundColor: '#111118', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-start justify-between mb-4">
            <Calendar className="w-8 h-8 text-green-400 flex-shrink-0" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold text-gray-100 mb-2">Monthly Compliance Archive</h3>
          <p className="text-sm text-gray-400 mb-6 flex-1">
            Access monthly compliance summaries and trend exports. Track performance over time by month and section.
          </p>
          <Link
            to="/management/archive"
            className="inline-flex items-center justify-center h-10 px-4 rounded-md font-medium text-sm transition-all"
            style={{
              backgroundColor: '#16A34A',
              color: '#F5F5F0',
            }}
          >
            Browse Archive
          </Link>
        </div>

        {/* Card 3: Export Raw Data */}
        <div
          className="rounded-lg border p-6 flex flex-col"
          style={{ backgroundColor: '#111118', borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-start justify-between mb-4">
            <Download className="w-8 h-8 text-orange-400 flex-shrink-0" aria-hidden />
          </div>
          <h3 className="text-lg font-semibold text-gray-100 mb-2">Export Raw Data</h3>
          <p className="text-sm text-gray-400 mb-6 flex-1">
            Export inspection data as CSV for any date range. Filtered by your permission level for compliance.
          </p>
          <button
            type="button"
            disabled={exporting}
            onClick={() => document.getElementById('export-panel')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center justify-center h-10 px-4 rounded-md font-medium text-sm transition-all disabled:opacity-60"
            style={{
              backgroundColor: '#EA580C',
              color: '#F5F5F0',
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Export Panel */}
      <div
        id="export-panel"
        className="rounded-lg border p-6"
        style={{ backgroundColor: '#111118', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="w-5 h-5 text-blue-400" aria-hidden />
          <h3 className="text-lg font-semibold text-gray-100">Export Inspection Data</h3>
        </div>

        <div className="space-y-4">
          {exportError && (
            <div
              className="rounded-md border px-4 py-3 text-sm"
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                borderColor: 'rgba(239,68,68,0.3)',
                color: '#FECACA',
              }}
            >
              {exportError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Start Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2 rounded-md border text-sm"
                style={{
                  backgroundColor: '#0F172A',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#F5F5F0',
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">End Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 rounded-md border text-sm"
                style={{
                  backgroundColor: '#0F172A',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: '#F5F5F0',
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exporting || !fromDate || !toDate}
            className="h-10 px-6 rounded-md font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#2563EB',
              color: '#F5F5F0',
            }}
          >
            {exporting ? 'Exporting...' : 'Download CSV'}
          </button>
        </div>

        {role === 'admin' && (
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <Link
              to="/admin"
              className="inline-flex items-center justify-center h-10 px-4 rounded-md font-medium text-sm transition-all"
              style={{
                backgroundColor: 'rgba(192,57,43,0.2)',
                color: '#F5F5F0',
                border: '1px solid rgba(192,57,43,0.4)',
              }}
            >
              Admin Panel
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
