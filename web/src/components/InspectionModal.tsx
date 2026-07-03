import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { BranchRow } from './InspectionTable';

interface InspectionRecord {
  id: string;
  branch_name: string;
  branch_type: string;
  city: string;
  region: string;
  inspection_date: string;
  compliance_score: number;
  risk_level: string;
  status: string;
  officer_name: string;
  responses: Array<{ section: string; item_text: string; response: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  branch: BranchRow | null;
  inspections: InspectionRecord[];
}

export default function InspectionModal({ open, onClose, branch, inspections }: Props) {
  const branchInspections = useMemo(() => {
    if (!branch) return [];
    return inspections
      .filter((item) => item.branch_name === branch.branchName)
      .sort((a, b) => new Date(a.inspection_date).getTime() - new Date(b.inspection_date).getTime());
  }, [branch, inspections]);

  const trendData = branchInspections.slice(-10).map((item) => ({
    label: new Date(item.inspection_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    score: item.compliance_score,
  }));

  const recurringIssues = useMemo(() => {
    const counts = new Map<string, number>();
    branchInspections.forEach((inspection) => {
      inspection.responses
        .filter((response) => response.response === 'Bad' || response.response === 'No')
        .forEach((response) => {
          const key = `${response.section} — ${response.item_text}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        });
    });

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [branchInspections]);

  if (!open || !branch) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex justify-end">
      <div className="w-full max-w-2xl h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-950 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{branch.branchName}</h2>
            <p className="text-sm text-gray-500">{branch.type} • {branch.city}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
              <div className="text-xs text-gray-500">Type</div>
              <div className="font-semibold mt-1">{branch.type}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
              <div className="text-xs text-gray-500">Location</div>
              <div className="font-semibold mt-1">{branch.city}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
              <div className="text-xs text-gray-500">Avg. Compliance</div>
              <div className="font-semibold mt-1">{branch.avgCompliance.toFixed(1)}%</div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 h-64">
            <div className="text-sm font-semibold mb-3">Last 10 Inspection Trend</div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#33415522" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                <Line dataKey="score" stroke="#0ea5e9" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <div className="text-sm font-semibold mb-3">Top 3 Recurring Issues</div>
            <div className="space-y-2">
              {recurringIssues.map((issue) => (
                <div key={issue.label} className="flex justify-between text-sm border-b border-gray-200 dark:border-gray-800 pb-2">
                  <span className="text-gray-700 dark:text-gray-200">{issue.label}</span>
                  <span className="font-semibold text-red-500">{issue.count}</span>
                </div>
              ))}
              {recurringIssues.length === 0 && <div className="text-sm text-gray-500">No recurring issues found.</div>}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
            <div className="text-sm font-semibold mb-3">Inspection Timeline</div>
            <div className="space-y-3">
              {branchInspections.slice().reverse().map((inspection) => (
                <div key={inspection.id} className="border-l-2 border-brand-500 pl-4">
                  <div className="text-sm font-medium">{new Date(inspection.inspection_date).toLocaleString('en-IN')}</div>
                  <div className="text-xs text-gray-500">{inspection.officer_name} • {inspection.status} • {inspection.compliance_score.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
