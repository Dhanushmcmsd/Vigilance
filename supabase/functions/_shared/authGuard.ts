/**
 * Shared authorization guard for privileged edge functions.
 * Allows cron/internal calls via x-cron-secret, or JWT callers with allowed roles.
 */
export async function enforceSecurityGuard(
  req: Request,
  options?: { allowedRoles?: string[] },
): Promise<Response | null> {
  const allowedRoles = options?.allowedRoles ?? ['management', 'admin'];
  const authHeader = req.headers.get('Authorization');
  const cronSecret = Deno.env.get('CRON_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Content-Type': 'application/json',
  };

  const cronHeader = req.headers.get('x-cron-secret');
  if (cronHeader && cronSecret && cronHeader === cronSecret) {
    return null;
  }

  if (authHeader) {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const { data: profile } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    if (!profile || !allowedRoles.includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: corsHeaders,
      });
    }
    return null;
  }

  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: corsHeaders,
  });
}

/** Cron-only guard for internal probes such as health-check. */
export function enforceCronOnlyGuard(req: Request): Response | null {
  const cronSecret = Deno.env.get('CRON_SECRET');
  const cronHeader = req.headers.get('x-cron-secret');
  if (cronHeader && cronSecret && cronHeader === cronSecret) {
    return null;
  }
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type, x-cron-secret',
      'Content-Type': 'application/json',
    },
  });
}
