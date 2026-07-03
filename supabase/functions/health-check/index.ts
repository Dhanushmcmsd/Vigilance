/**
 * health-check
 * ─────────────────────────────────────────────────────────────────────────────
 * GET /functions/v1/health-check
 *
 * Minimal liveness probe for cron/uptime monitors.
 * Requires x-cron-secret matching CRON_SECRET — no public access.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { enforceCronOnlyGuard } from '../_shared/authGuard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // --- SECURITY: Cron-only authorization guard ---
  const authDenied = enforceCronOnlyGuard(req);
  if (authDenied) return authDenied;
  // --- END security guard ---

  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    },
  );
});
