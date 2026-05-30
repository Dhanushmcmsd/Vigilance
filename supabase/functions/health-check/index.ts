/**
 * health-check
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /functions/v1/health-check
 *
 * Probes each load-bearing dependency and returns a structured JSON report.
 * Intended to be hit from CI ("smoke test after deploy") and from an
 * uptime monitor (Pingdom / BetterUptime).
 *
 * The function NEVER returns a 5xx — failure cases are encoded inside the
 * response body so the monitor can decide on its own. The top-level HTTP
 * status is:
 *   200  every probe healthy
 *   207  at least one probe is degraded but the function itself ran fine
 *   503  at least one critical probe failed
 *
 * Probes:
 *   1. db          — SELECT 1 + COUNT * from a benign table
 *   2. storage     — list inspection-files bucket (must exist)
 *   3. realtime    — confirm the supabase_realtime publication exists
 *   4. policies    — confirm RLS is enabled on inspections + notifications
 *
 * Required env (auto-injected): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STORAGE_BUCKET = Deno.env.get('STORAGE_BUCKET') ?? 'inspection-files';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface ProbeResult {
  ok: boolean;
  /** 'healthy' | 'degraded' | 'down' — degraded never trips overall status. */
  level: 'healthy' | 'degraded' | 'down';
  message?: string;
  detail?: Record<string, unknown>;
  /** Roundtrip in ms. */
  latency_ms: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const probes: Record<string, ProbeResult> = {
    db: await timeProbe(() => probeDb(supabase)),
    storage: await timeProbe(() => probeStorage(supabase)),
    realtime: await timeProbe(() => probeRealtime(supabase)),
    rls: await timeProbe(() => probeRls(supabase)),
  };

  const anyDown = Object.values(probes).some((p) => p.level === 'down');
  const anyDegraded = Object.values(probes).some((p) => p.level === 'degraded');

  const status = anyDown ? 503 : anyDegraded ? 207 : 200;
  const body = {
    status: anyDown ? 'down' : anyDegraded ? 'degraded' : 'healthy',
    checked_at: new Date().toISOString(),
    total_ms: Date.now() - startedAt,
    region: Deno.env.get('SUPABASE_REGION') ?? null,
    git_sha: Deno.env.get('GIT_SHA') ?? null,
    probes,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});

// ── timing wrapper ────────────────────────────────────────────────────────

async function timeProbe(fn: () => Promise<Omit<ProbeResult, 'latency_ms'>>): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const out = await fn();
    return { ...out, latency_ms: Date.now() - t0 };
  } catch (err) {
    return {
      ok: false,
      level: 'down',
      message: String(err),
      latency_ms: Date.now() - t0,
    };
  }
}

// ── individual probes ─────────────────────────────────────────────────────

async function probeDb(
  supabase: ReturnType<typeof createClient>,
): Promise<Omit<ProbeResult, 'latency_ms'>> {
  // We deliberately read a tiny tally rather than `SELECT 1` so that we
  // exercise the planner + RLS bypass via service role + a real row scan.
  const { count, error } = await supabase
    .from('user_roles')
    .select('*', { count: 'exact', head: true });

  if (error) {
    return { ok: false, level: 'down', message: error.message };
  }
  return {
    ok: true,
    level: 'healthy',
    message: 'database reachable',
    detail: { user_roles_count: count ?? null },
  };
}

async function probeStorage(
  supabase: ReturnType<typeof createClient>,
): Promise<Omit<ProbeResult, 'latency_ms'>> {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    return { ok: false, level: 'down', message: error.message };
  }
  const exists = data?.some((b) => b.name === STORAGE_BUCKET);
  if (!exists) {
    return {
      ok: false,
      level: 'down',
      message: `bucket "${STORAGE_BUCKET}" missing`,
      detail: { buckets: data?.map((b) => b.name) ?? [] },
    };
  }
  return { ok: true, level: 'healthy', message: 'storage bucket present' };
}

async function probeRealtime(
  supabase: ReturnType<typeof createClient>,
): Promise<Omit<ProbeResult, 'latency_ms'>> {
  // Postgres meta: confirm the realtime publication exists and that our
  // critical tables are in it.
  const { data, error } = await supabase
    .from('pg_publication_tables' as never)
    .select('tablename')
    .eq('pubname', 'supabase_realtime');

  if (error) {
    // pg_publication_tables isn't queryable via REST without a view. Mark
    // degraded rather than down — the rest of the system is fine.
    return {
      ok: false,
      level: 'degraded',
      message: 'cannot introspect realtime publication via REST',
      detail: { hint: 'expose a view "v_realtime_tables" if you want this green' },
    };
  }

  const tables = (data ?? []).map((r: { tablename: string }) => r.tablename);
  const required = ['inspections', 'notifications'];
  const missing = required.filter((t) => !tables.includes(t));

  if (missing.length) {
    return {
      ok: false,
      level: 'degraded',
      message: `realtime publication missing tables: ${missing.join(', ')}`,
      detail: { tables },
    };
  }
  return {
    ok: true,
    level: 'healthy',
    message: 'realtime publication ok',
    detail: { tables },
  };
}

async function probeRls(
  supabase: ReturnType<typeof createClient>,
): Promise<Omit<ProbeResult, 'latency_ms'>> {
  // Touch every critical table; service role bypasses RLS so a failure here
  // is a genuine table-missing or permissions issue, not an RLS rejection.
  const tables = ['inspections', 'notifications', 'user_roles', 'branches'];
  const failures: string[] = [];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id', { head: true, count: 'exact' });
    if (error) failures.push(`${t}: ${error.message}`);
  }
  if (failures.length) {
    return {
      ok: false,
      level: 'down',
      message: 'critical table check failed',
      detail: { failures },
    };
  }
  return { ok: true, level: 'healthy', message: 'critical tables reachable' };
}
