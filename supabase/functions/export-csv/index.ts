/**
 * export-csv
 * ─────────────────────────────────────────────────────────────────────────────
 * Streams an inspections CSV. Doing this in an edge function (vs. building it
 * client-side in ManagementDashboard) avoids two real problems:
 *   - The browser has to hold every row in memory before it can write the file.
 *     For 12 months × all-branches this can easily exceed 100MB once you
 *     flatten responses.
 *   - The Vite dev server times out at ~30s on big queries.
 *
 * The function paginates with `range()` (1k rows per fetch) and writes each
 * batch directly into a `ReadableStream`, so memory stays flat regardless of
 * how big the export is.
 *
 * Auth model: callers must pass their Supabase JWT in the Authorization
 * header. The function builds a Supabase client with that JWT so RLS is
 * enforced — heads see all rows, management sees only `approved`, officers
 * see only their own.
 *
 * Query params (all optional):
 *   from=YYYY-MM-DD   inclusive lower bound on inspection_date
 *   to=YYYY-MM-DD     inclusive upper bound
 *   status=approved   filter by status (any of: draft|submitted|approved|rejected)
 *   branch_id=<uuid>  restrict to one branch
 *   risk_level=high   filter by risk
 *
 * Required env: SUPABASE_URL (auto-injected). Service key NOT used — we use
 * the caller's JWT so RLS applies.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { rateLimit } from '../_shared/rateLimit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const BATCH_SIZE = 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('missing Authorization header', {
      status: 401,
      headers: corsHeaders,
    });
  }

  // CSV generation is expensive — pagination over inspections + responses can
  // easily touch 100k rows. Cap to 10 exports/minute per caller; the same
  // caller spamming the dashboard's "Export" button can't bring us down.
  const rl = await rateLimit(req, {
    id: 'export-csv',
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.allowed) return rl.response!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status');
  const branchId = url.searchParams.get('branch_id');
  const riskLevel = url.searchParams.get('risk_level');

  const filename = buildFilename({ from, to, status });

  // Build a stream so we can write rows as we fetch them. The encoder takes
  // a string -> Uint8Array and ReadableStream owns the back-pressure.
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const header = [
          'inspection_id',
          'inspection_date',
          'submitted_at',
          'status',
          'risk_level',
          'compliance_score',
          'sync_status',
          'app_version',
          'device_id',
          'branch_name',
          'branch_type',
          'city',
          'region',
          'officer_name',
          'section',
          'item',
          'response',
          'remarks',
        ];
        controller.enqueue(encoder.encode(header.join(',') + '\n'));

        let offset = 0;
        let fetched = 0;

        // Pull one batch at a time. We use `range()` (Postgres LIMIT/OFFSET
        // under the hood) which is fine for our row counts; if this ever
        // grows past a few hundred thousand inspections we'd switch to
        // keyset pagination on `inspection_date desc, id desc`.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          let q = supabase
            .from('inspections')
            .select(
              `id, inspection_date, submitted_at, status, risk_level,
               compliance_score, sync_status, app_version, device_id,
               branch:branches!inspections_branch_id_fkey ( branch_name, city, region,
                 branch_type:branch_types!branches_branch_type_id_fkey ( type_name ) ),
               officer:user_roles!inspections_officer_id_fkey ( name ),
               responses:inspection_responses (
                 response, remarks,
                 item:checklist_templates!inspection_responses_checklist_item_id_fkey ( section, item_text )
               )`,
            )
            .order('inspection_date', { ascending: false })
            .range(offset, offset + BATCH_SIZE - 1);

          if (from) q = q.gte('inspection_date', from);
          if (to) q = q.lte('inspection_date', to);
          if (status) q = q.eq('status', status);
          if (branchId) q = q.eq('branch_id', branchId);
          if (riskLevel) q = q.eq('risk_level', riskLevel);

          const { data, error } = await q;
          if (error) throw error;
          if (!data || data.length === 0) break;

          for (const ins of data as InspectionRow[]) {
            const branch = unwrap(ins.branch);
            const branchType = unwrap(branch?.branch_type);
            const officer = unwrap(ins.officer);
            const responses = ins.responses ?? [];

            if (responses.length === 0) {
              controller.enqueue(
                encoder.encode(
                  toCsvRow([
                    ins.id,
                    ins.inspection_date,
                    ins.submitted_at,
                    ins.status,
                    ins.risk_level,
                    ins.compliance_score,
                    ins.sync_status,
                    ins.app_version,
                    ins.device_id,
                    branch?.branch_name,
                    branchType?.type_name,
                    branch?.city,
                    branch?.region,
                    officer?.name,
                    '',
                    '',
                    '',
                    '',
                  ]),
                ),
              );
              fetched += 1;
              continue;
            }

            for (const r of responses) {
              const item = unwrap(r.item);
              controller.enqueue(
                encoder.encode(
                  toCsvRow([
                    ins.id,
                    ins.inspection_date,
                    ins.submitted_at,
                    ins.status,
                    ins.risk_level,
                    ins.compliance_score,
                    ins.sync_status,
                    ins.app_version,
                    ins.device_id,
                    branch?.branch_name,
                    branchType?.type_name,
                    branch?.city,
                    branch?.region,
                    officer?.name,
                    item?.section,
                    item?.item_text,
                    r.response,
                    r.remarks,
                  ]),
                ),
              );
            }
            fetched += 1;
          }

          if (data.length < BATCH_SIZE) break;
          offset += BATCH_SIZE;
        }

        controller.enqueue(
          encoder.encode(`# total_inspections=${fetched}\n`),
        );
        controller.close();
      } catch (err) {
        console.error('export-csv stream failed', err);
        controller.enqueue(encoder.encode(`# error=${String(err)}\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});

// ── helpers ───────────────────────────────────────────────────────────────

type CsvCell = string | number | null | undefined;

interface InspectionRow {
  id: string;
  inspection_date: string;
  submitted_at: string | null;
  status: string;
  risk_level: string | null;
  compliance_score: number | null;
  sync_status: string | null;
  app_version: string | null;
  device_id: string | null;
  branch:
    | { branch_name: string; city: string; region: string; branch_type: { type_name: string } | { type_name: string }[] | null }
    | { branch_name: string; city: string; region: string; branch_type: { type_name: string } | { type_name: string }[] | null }[]
    | null;
  officer: { name: string } | { name: string }[] | null;
  responses:
    | Array<{
        response: string;
        remarks: string | null;
        item: { section: string; item_text: string } | { section: string; item_text: string }[] | null;
      }>
    | null;
}

// Supabase types one-to-one relationships as arrays in some generated client
// shapes; this helper coerces back to a single row.
function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function escapeCsv(v: CsvCell): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsvRow(cells: CsvCell[]): string {
  return cells.map(escapeCsv).join(',') + '\n';
}

function buildFilename(params: {
  from: string | null;
  to: string | null;
  status: string | null;
}) {
  const tag = params.status ?? 'all';
  const stamp = new Date().toISOString().slice(0, 10);
  const range = params.from || params.to ? `_${params.from ?? ''}_${params.to ?? ''}` : '';
  return `inspections_${tag}${range}_${stamp}.csv`;
}
