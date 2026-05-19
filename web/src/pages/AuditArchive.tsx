import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileDown } from 'lucide-react';
import { useManagementInspections } from '../hooks/useManagementInspections';
import { formatMonthLabel, monthKey } from '../lib/inspectionQueries';
import { fetchInspectionForPdf } from '../lib/auditExport';
import RiskBadge from '../components/RiskBadge';

interface AuditArchiveProps {
  backPath: string;
  backLabel: string;
}

export default function AuditArchive({ backPath, backLabel }: AuditArchiveProps) {
  const { data = [], isLoading } = useManagementInspections();
  const [selectedMonth, setSelectedMonth] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const months = useMemo(() => {
    const keys = new Set(data.map((i) => monthKey(i.inspection_date)));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const activeMonth = selectedMonth || months[0] || '';

  const monthRows = useMemo(() => {
    if (!activeMonth) return [];
    return data
      .filter((i) => monthKey(i.inspection_date) === activeMonth)
      .sort((a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime());
  }, [data, activeMonth]);

  const exportPdf = async (inspectionId: string) => {
    setExportingId(inspectionId);
    setToast('Generating audit PDF…');
    try {
      const pdfData = await fetchInspectionForPdf(inspectionId);
      if (!pdfData) throw new Error('Inspection not found');
      const { generateInspectionPdf } = await import('../components/InspectionPdfReport');
      const filename = await generateInspectionPdf(pdfData);
      setToast(`Downloaded ${filename}`);
    } catch {
      setToast('PDF export failed.');
    } finally {
      setExportingId(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={backPath} className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-brand-600">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit report archive</h1>
          <p className="mt-1 text-sm text-slate-500">
            Corporate audit PDFs by month — includes checklist findings and officer evidence photos.
          </p>
        </div>
        <select
          value={activeMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-lg border px-4 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-900"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {formatMonthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Officer</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Files</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading &&
              monthRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(row.inspection_date).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 font-medium">{row.branch_name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.officer_name}</td>
                  <td className="px-4 py-3 font-bold tabular-nums">{row.compliance_score.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <RiskBadge level={row.risk_level} />
                  </td>
                  <td className="px-4 py-3 capitalize">{row.status}</td>
                  <td className="px-4 py-3">{row.file_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={exportingId === row.id}
                      onClick={() => void exportPdf(row.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      {exportingId === row.id ? '…' : 'PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            {!isLoading && !monthRows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                  No inspections for this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
