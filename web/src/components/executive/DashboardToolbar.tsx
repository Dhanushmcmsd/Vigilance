import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Archive, ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RangeKey } from '../../lib/dateRanges';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'Last 3 months' },
  { key: 'custom', label: 'Custom' },
];

interface DashboardToolbarProps {
  range: RangeKey;
  onRangeChange: (range: RangeKey) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (value: string) => void;
  onCustomToChange: (value: string) => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onExportWord: () => void;
  exporting?: boolean;
}

export default function DashboardToolbar({
  range,
  onRangeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onExportCsv,
  onExportPdf,
  onExportWord,
  exporting,
}: DashboardToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const runExport = (action: () => void | Promise<void>) => {
    void action();
    setExportOpen(false);
  };

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <motion.div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onRangeChange(key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-200 ${
              range === key
                ? 'bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900'
                : 'border border-slate-200/90 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </motion.div>

      <div className="flex flex-wrap items-center gap-3">
        {range === 'custom' && (
          <div className="flex gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(event) => onCustomFromChange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <input
              type="date"
              value={customTo}
              onChange={(event) => onCustomToChange(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        )}

        <Link
          to="/management/archive"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <Archive className="h-4 w-4" />
          Archive
        </Link>

        <motion.div ref={exportRef} className="relative">
          <button
            type="button"
            disabled={exporting}
            onClick={() => setExportOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className={`h-4 w-4 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
          </button>
          {exportOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                onClick={() => runExport(onExportCsv)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => runExport(onExportPdf)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileText className="h-4 w-4" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => runExport(onExportWord)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <FileText className="h-4 w-4" />
                Download Word
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
