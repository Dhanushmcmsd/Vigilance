import type { UnderperformingBranch } from '../lib/managementAnalytics';
import RiskBadge from './RiskBadge';

interface Props {
  rows: UnderperformingBranch[];
  onSelect?: (branchName: string) => void;
  surface?: 'default' | 'bloom';
}

export default function UnderperformingTable({ rows, onSelect, surface = 'default' }: Props) {
  const isBloom = surface === 'bloom';

  if (!rows.length) {
    return (
      <p className={`text-sm py-6 text-center ${isBloom ? 'text-white/65' : 'text-slate-500 dark:text-slate-400'}`}>
        No underperforming branches in this period — network is within target.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr
            className={`text-left text-xs uppercase tracking-wider border-b ${
              isBloom
                ? 'text-white/60 border-white/15'
                : 'text-slate-500 border-slate-200 dark:border-slate-800'
            }`}
          >
            <th className="py-3 pr-4 font-semibold">Branch</th>
            <th className="py-3 pr-4 font-semibold">Region</th>
            <th className="py-3 pr-4 font-semibold">Compliance</th>
            <th className="py-3 pr-4 font-semibold">NC rate</th>
            <th className="py-3 pr-4 font-semibold">Critical</th>
            <th className="py-3 pr-4 font-semibold">Risk</th>
            <th className="py-3 font-semibold">Last visit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.branchName}
              className={`border-b transition-colors cursor-pointer ${
                isBloom
                  ? 'border-white/10 hover:bg-white/5'
                  : 'border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
              }`}
              onClick={() => onSelect?.(row.branchName)}
            >
              <td className="py-3 pr-4">
                <div className={`font-semibold ${isBloom ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {row.branchName}
                </div>
                <div className={isBloom ? 'text-xs text-white/55' : 'text-xs text-slate-500'}>
                  {row.type} · {row.city}
                </div>
              </td>
              <td className={`py-3 pr-4 ${isBloom ? 'text-white/80' : 'text-slate-600 dark:text-slate-300'}`}>
                {row.region}
              </td>
              <td className="py-3 pr-4">
                <span
                  className={`font-bold tabular-nums ${
                    row.avgCompliance < 60
                      ? isBloom ? 'text-red-300' : 'text-red-600'
                      : row.avgCompliance < 80
                        ? isBloom ? 'text-amber-300' : 'text-amber-600'
                        : isBloom ? 'text-emerald-300' : 'text-emerald-600'
                  }`}
                >
                  {row.avgCompliance.toFixed(1)}%
                </span>
              </td>
              <td className={`py-3 pr-4 tabular-nums ${isBloom ? 'text-white/85' : 'text-slate-700 dark:text-slate-200'}`}>
                {row.violationRate.toFixed(1)}%
              </td>
              <td className={`py-3 pr-4 font-semibold ${isBloom ? 'text-red-300' : 'text-red-600'}`}>
                {row.criticalCount}
              </td>
              <td className="py-3 pr-4">
                <RiskBadge level={row.riskLevel} />
              </td>
              <td className={`py-3 ${isBloom ? 'text-white/80' : 'text-slate-600 dark:text-slate-300'}`}>
                {new Date(row.lastInspected).toLocaleDateString('en-IN')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
