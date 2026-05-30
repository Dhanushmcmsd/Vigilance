import RiskBadge from './RiskBadge';

export interface BranchRow {
  branchName: string;
  type: string;
  city: string;
  inspections: number;
  avgCompliance: number;
  riskLevel: string;
  lastInspected: string;
}

interface Props {
  rows: BranchRow[];
  sortKey: keyof BranchRow;
  sortDirection: 'asc' | 'desc';
  onSort: (key: keyof BranchRow) => void;
  onView: (row: BranchRow) => void;
}

const complianceColor = (value: number) => {
  if (value >= 80) return 'text-green-600';
  if (value >= 60) return 'text-yellow-600';
  if (value >= 40) return 'text-orange-600';
  return 'text-red-600';
};

export default function InspectionTable({ rows, sortKey, sortDirection, onSort, onView }: Props) {
  const headers: { key: keyof BranchRow; label: string }[] = [
    { key: 'branchName', label: 'Branch Name' },
    { key: 'type', label: 'Type' },
    { key: 'city', label: 'City' },
    { key: 'inspections', label: 'Inspections' },
    { key: 'avgCompliance', label: 'Avg Compliance %' },
    { key: 'riskLevel', label: 'Risk Level' },
    { key: 'lastInspected', label: 'Last Inspected' },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Branch Compliance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              {headers.map((header) => (
                <th
                  key={header.key}
                  className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 cursor-pointer whitespace-nowrap"
                  onClick={() => onSort(header.key)}
                >
                  {header.label} {sortKey === header.key ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.branchName}-${row.lastInspected}`} className="border-t border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{row.branchName}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.type}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.city}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.inspections}</td>
                <td className={`px-4 py-3 font-semibold ${complianceColor(row.avgCompliance)}`}>{row.avgCompliance.toFixed(1)}%</td>
                <td className="px-4 py-3"><RiskBadge level={row.riskLevel} /></td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{row.lastInspected}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onView(row)}
                    className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">No branch data found for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
