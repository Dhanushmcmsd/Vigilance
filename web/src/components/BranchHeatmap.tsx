import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

interface SectionIssue {
  section: string;
  issues: number;
}

const getColor = (value: number) => {
  if (value > 20) return '#ef4444';
  if (value >= 10) return '#f59e0b';
  return '#22c55e';
};

export default function BranchHeatmap({ data }: { data: SectionIssue[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-5 h-[360px]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Issues by Section</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Most frequently failed checklist sections</p>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#33415522" />
          <XAxis dataKey="section" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="issues" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.issues)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
