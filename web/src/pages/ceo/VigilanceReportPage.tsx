import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Store } from 'lucide-react';
import AuditArchive from '../AuditArchive';
import { BloomGradientPanel } from '../../components/ui/BloomGradientPanel';
import { supabase } from '../../lib/supabase';
import { auditScoreColor } from '../../lib/auditReports';
import { computeDistrictReportSummaries } from '../../lib/districtCalculations';

interface BranchSummary {
  id: string;
  branch_name: string;
  city: string | null;
  region: string | null;
  reportCount: number;
  lastScore: number | null;
}

/** Vigilance Report tab — L1 district picker, L2 district-scoped AuditArchive. */
export default function VigilanceReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDistrict = searchParams.get('district');

  const { data: branches, isLoading } = useQuery<BranchSummary[]>({
    queryKey: ['vigilance-report-branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select(
          `
          id, branch_name, city, region,
          inspections!inspections_branch_id_fkey (
            id, status, compliance_score, submitted_at
          )
        `,
        )
        .eq('is_active', true)
        .order('branch_name', { ascending: true });
      if (error) throw error;

      return ((data ?? []) as {
        id: string;
        branch_name: string;
        city: string | null;
        region: string | null;
        inspections: { status: string; compliance_score: number | null; submitted_at: string | null }[] | null;
      }[]).map((branch) => {
        const submitted = (branch.inspections ?? []).filter((row) => row.status !== 'draft');
        const sorted = [...submitted].sort(
          (a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime(),
        );
        return {
          id: branch.id,
          branch_name: branch.branch_name,
          city: branch.city,
          region: branch.region,
          reportCount: submitted.length,
          lastScore: sorted[0]?.compliance_score ?? null,
        };
      });
    },
  });

  const districtSummaries = useMemo(
    () => computeDistrictReportSummaries(branches ?? []),
    [branches],
  );

  const openDistrict = (district: string) => {
    setSearchParams({ district });
  };

  const backToDistricts = () => {
    setSearchParams({});
  };

  if (selectedDistrict) {
    return (
      <div className="space-y-5">
        <button type="button" onClick={backToDistricts} className="bloom-link min-h-[44px]">
          <ArrowLeft className="h-4 w-4" />
          Back to Districts
        </button>
        <AuditArchive districtFilter={selectedDistrict} />
      </div>
    );
  }

  return (
    <BloomGradientPanel>
      <h2 className="bloom-heading mb-1 text-lg font-semibold">Vigilance Report</h2>
      <p className="bloom-subtitle mb-4 text-sm">
        Select a district to browse store reports, filter submissions, and export compliance summaries.
      </p>
      {isLoading ? (
        <p className="py-12 text-center text-white/65">Loading districts…</p>
      ) : districtSummaries.length === 0 ? (
        <p className="py-12 text-center text-white/65">No district reports yet.</p>
      ) : (
        <div className="space-y-3">
          {districtSummaries.map((district) => {
            const scoreColor = auditScoreColor(district.avgCompliance);
            return (
              <button
                key={district.district}
                type="button"
                onClick={() => openDistrict(district.district)}
                className="bloom-panel-nested flex w-full items-center gap-4 p-4 text-left"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Store className="h-5 w-5 text-white/70" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{district.district}</p>
                  <p className="text-sm text-white/65">{district.location}</p>
                  <p className="mt-1.5 text-xs font-medium text-white/50">
                    {district.reportCount} {district.reportCount === 1 ? 'report' : 'reports'} ·{' '}
                    {district.storeCount} {district.storeCount === 1 ? 'store' : 'stores'}
                  </p>
                </div>
                {district.avgCompliance !== null ? (
                  <span className="text-xl font-black tabular-nums" style={{ color: scoreColor }}>
                    {district.avgCompliance.toFixed(0)}%
                  </span>
                ) : null}
                <ChevronRight className="h-5 w-5 shrink-0 text-white/45" />
              </button>
            );
          })}
        </div>
      )}
    </BloomGradientPanel>
  );
}
