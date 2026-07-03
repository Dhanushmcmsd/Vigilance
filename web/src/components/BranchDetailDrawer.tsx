import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import { Camera, FileText, MapPin, User, Calendar, ShieldCheck } from 'lucide-react';

import { supabase } from '../lib/supabase';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import RiskBadge from './RiskBadge';
import { collectInspectionImageFiles, resolveInspectionMediaUrl } from '../lib/inspectionMedia';
import { isInspectionImageFile } from '../lib/inspectionImages';

interface BranchDetailDrawerProps {
  branchName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback so the parent can trigger a PDF export from the drawer. */
  onExportPdf?: () => void;
}

interface BranchSummary {
  branch_id: string;
  branch_name: string;
  branch_type: string;
  city: string | null;
  region: string | null;
  inspections: BranchInspection[];
  officers: { id: string; name: string; count: number }[];
}

interface BranchInspection {
  id: string;
  inspection_date: string;
  submitted_at: string | null;
  compliance_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | string;
  status: string;
  officer_name: string;
  files: { url: string; type: 'image' | 'document' | string; name: string }[];
}

/**
 * Slide-in panel that shows per-branch history, compliance trend, photo
 * gallery, and the officers assigned to that branch (inferred from the latest
 * 50 inspections — we don't have a dedicated officer-branch assignment table
 * yet).
 */
export default function BranchDetailDrawer({
  branchName,
  open,
  onOpenChange,
  onExportPdf,
}: BranchDetailDrawerProps) {
  const { data, isLoading, error } = useQuery<BranchSummary | null>({
    queryKey: ['branch-detail', branchName],
    enabled: open && !!branchName,
    queryFn: async () => {
      // 1. Resolve the branch by name.
      const { data: branch, error: branchErr } = await supabase
        .from('branches')
        .select(
          `id, branch_name, city, region,
           branch_type:branch_types!branches_branch_type_id_fkey ( type_name )`,
        )
        .eq('branch_name', branchName!)
        .maybeSingle();
      if (branchErr) throw branchErr;
      if (!branch) return null;

      // 2. Pull the latest 50 inspections for that branch.
      const { data: rows, error: insErr } = await supabase
        .from('inspections')
        .select(
          `id, inspection_date, submitted_at, compliance_score, risk_level, status,
           officer:user_roles!inspections_officer_id_fkey ( name ),
           inspection_files ( id, file_url, file_type, file_name, checklist_item_id ),
           inspection_answers ( checklist_item_id, photo_url )`,
        )
        .eq('branch_id', branch.id)
        .order('inspection_date', { ascending: false })
        .limit(50);
      if (insErr) throw insErr;

      const inspections: BranchInspection[] = (rows ?? []).map((r: any) => ({
        id: r.id,
        inspection_date: r.inspection_date,
        submitted_at: r.submitted_at,
        compliance_score: Number(r.compliance_score ?? 0),
        risk_level: r.risk_level ?? 'low',
        status: r.status,
        officer_name: r.officer?.name ?? 'Unknown',
        files: collectInspectionImageFiles(
          (r.inspection_files ?? []).map((f: any, index: number) => ({
            id: f.id ?? `file:${index}`,
            file_url: f.file_url,
            file_name: f.file_name ?? 'Inspection evidence',
            file_type: f.file_type ?? 'image',
            checklist_item_id: f.checklist_item_id ?? null,
          })),
          (r.inspection_answers ?? []).map((answer: any) => ({
            checklist_item_id: answer.checklist_item_id ?? null,
            photo_url: answer.photo_url ?? null,
          })),
        ).map((f) => ({
          url: f.file_url,
          type: 'image',
          name: f.file_name,
        })),
      }));

      // 3. Roll inspections up into a per-officer count.
      const officerMap = new Map<string, { id: string; name: string; count: number }>();
      for (const ins of inspections) {
        const key = ins.officer_name;
        const existing = officerMap.get(key) ?? { id: key, name: key, count: 0 };
        existing.count += 1;
        officerMap.set(key, existing);
      }

      const bt = Array.isArray(branch.branch_type) ? branch.branch_type[0] : branch.branch_type;

      return {
        branch_id: branch.id,
        branch_name: branch.branch_name,
        branch_type: bt?.type_name ?? '—',
        city: branch.city,
        region: branch.region,
        inspections,
        officers: Array.from(officerMap.values()).sort((a, b) => b.count - a.count),
      };
    },
  });

  // Compliance trend — chronological (oldest → newest) over the last 12 inspections.
  const trendData = useMemo(() => {
    if (!data) return [];
    return data.inspections
      .slice()
      .sort((a, b) => a.inspection_date.localeCompare(b.inspection_date))
      .slice(-12)
      .map((ins) => ({
        label: new Date(ins.inspection_date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        }),
        score: ins.compliance_score,
      }));
  }, [data]);

  const photos = useMemo(() => {
    if (!data) return [];
    const out: { url: string; name: string; inspectionId: string; date: string }[] = [];
    for (const ins of data.inspections) {
      for (const f of ins.files) {
        if (isInspectionImageFile({ file_url: f.url, file_name: f.name, file_type: f.type })) {
          out.push({
            url: f.url,
            name: f.name,
            inspectionId: ins.id,
            date: ins.inspection_date,
          });
        }
      }
    }
    return out.slice(0, 24);
  }, [data]);

  const [resolvedPhotoUrls, setResolvedPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    if (!photos.length) {
      setResolvedPhotoUrls({});
      return;
    }
    void Promise.all(
      photos.map(async (photo) => [photo.url, await resolveInspectionMediaUrl(photo.url)] as const),
    ).then((entries) => {
      if (cancelled) return;
      setResolvedPhotoUrls(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [photos]);

  const avgScore = useMemo(() => {
    if (!data || data.inspections.length === 0) return 0;
    return (
      data.inspections.reduce((sum, i) => sum + i.compliance_score, 0) /
      data.inspections.length
    );
  }, [data]);

  const latestRisk = data?.inspections[0]?.risk_level;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        {/* Header */}
        <SheetHeader className="border-b px-6 py-5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <SheetTitle className="text-2xl">
                {data?.branch_name ?? branchName ?? 'Branch'}
              </SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{data?.branch_type ?? '—'}</Badge>
                {latestRisk && <RiskBadge level={latestRisk} />}
                {data?.city && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {data.city}
                    {data.region ? `, ${data.region}` : ''}
                  </span>
                )}
              </SheetDescription>
            </div>
            {onExportPdf && (
              <Button variant="outline" size="sm" onClick={onExportPdf} className="shrink-0">
                <FileText className="h-4 w-4" /> Export PDF
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* Body — independently scrollable */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading branch detail…</div>
          ) : error ? (
            <div className="p-6 m-6 rounded-lg bg-destructive/10 text-destructive text-sm">
              Couldn't load branch detail.
            </div>
          ) : !data ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No data for this branch.</div>
          ) : (
            <div className="p-6 space-y-6">
              {/* KPI strip */}
              <div className="grid grid-cols-3 gap-3">
                <KpiTile
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Avg compliance"
                  value={`${avgScore.toFixed(1)}%`}
                />
                <KpiTile
                  icon={<Calendar className="h-4 w-4" />}
                  label="Inspections"
                  value={data.inspections.length.toString()}
                />
                <KpiTile
                  icon={<User className="h-4 w-4" />}
                  label="Officers"
                  value={data.officers.length.toString()}
                />
              </div>

              {/* Trend */}
              {trendData.length > 1 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Compliance trend</h3>
                  <div className="h-44 rounded-lg border bg-card p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RechartsTooltip
                          contentStyle={{
                            background: 'hsl(var(--popover))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Officer assignments */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Officers (recent activity)</h3>
                {data.officers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No officer history yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.officers.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {o.name}
                        </span>
                        <Badge variant="outline">
                          {o.count} inspection{o.count === 1 ? '' : 's'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Photo gallery */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Photo gallery ({photos.length})
                </h3>
                {photos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No photos uploaded for this branch.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((p) => {
                      const displayUrl = resolvedPhotoUrls[p.url] ?? p.url;
                      return (
                        <a
                          key={`${p.inspectionId}-${p.url}`}
                          href={displayUrl}
                          target="_blank"
                          rel="noreferrer"
                          title={`${p.name} · ${p.date}`}
                          className="aspect-square overflow-hidden rounded-md border bg-muted hover:opacity-90 transition-opacity"
                        >
                          <img src={displayUrl} alt={p.name} className="h-full w-full object-cover" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inspection history */}
              <div>
                <h3 className="text-sm font-semibold mb-2">History</h3>
                <div className="rounded-lg border divide-y">
                  {data.inspections.slice(0, 10).map((ins) => (
                    <div
                      key={ins.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{ins.officer_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(ins.inspection_date).toLocaleDateString('en-IN')} ·{' '}
                          {ins.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <RiskBadge level={ins.risk_level} />
                        <span className="text-sm font-semibold">
                          {ins.compliance_score.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function KpiTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-xl font-semibold mt-0.5">{value}</div>
    </div>
  );
}
