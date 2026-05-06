interface FiltersProps {
  branchTypes: string[];
  branchNames: string[];
  selectedType: string;
  selectedBranch: string;
  selectedStatus: string;
  selectedRisk: string;
  onTypeChange: (v: string) => void;
  onBranchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onRiskChange: (v: string) => void;
}

export default function Filters({
  branchTypes, branchNames, selectedType, selectedBranch, selectedStatus, selectedRisk,
  onTypeChange, onBranchChange, onStatusChange, onRiskChange,
}: FiltersProps) {
  const selectClass = "block w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="flex flex-wrap gap-3">
      <select value={selectedType} onChange={(e) => onTypeChange(e.target.value)} className={selectClass}>
        <option value="">All Types</option>
        {branchTypes.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <select value={selectedBranch} onChange={(e) => onBranchChange(e.target.value)} className={selectClass}>
        <option value="">All Branches</option>
        {branchNames.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      <select value={selectedStatus} onChange={(e) => onStatusChange(e.target.value)} className={selectClass}>
        <option value="">All Statuses</option>
        <option value="submitted">Submitted</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
      <select value={selectedRisk} onChange={(e) => onRiskChange(e.target.value)} className={selectClass}>
        <option value="">All Risk Levels</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
  );
}
