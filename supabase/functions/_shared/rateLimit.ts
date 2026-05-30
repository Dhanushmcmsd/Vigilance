/**
 * Rate-limit helper for Supabase Edge Functions.
 * ─────────────────────────────────────────────────────────────────────────────
 * Backed by Upstash Redis REST so it works inside the Deno runtime without
 * a TCP redis driver. We deliberately keep the surface minimal — no @upstash
 * SDK because its bundling story on Supabase Edge has been flaky.
 *
 * Implementation: sliding-window over a single counter key. The counter is
 * INCR-ed atomically; if the result is 1 we set an EXPIRE so the window
 * eventually rolls. The whole thing is one POST to Upstash's pipeline
 * endpoint (atomic on their side).
 *
 * Costs: 1 round-trip per request. Upstash REST p50 is ~10ms from Supabase
 * functions; well below the rest of the edge function's latency budget.
 *
 * Required env (set via `supabase secrets set`):
 *   UPSTASH_REDIS_REST_URL    e.g. https://us1-foo.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  REST token (NOT the read-only one)
 *
 * Graceful degrade: if either env var is missing the limiter no-ops and
 * returns `{ allowed: true, degraded: true }`. We never fail closed — losing
 * Upstash should not take the whole API offline.
 *
 * Usage:
 *   const rl = await rateLimit(req, { id: 'inspection-submit', limit: 30, windowSeconds: 60 });
 *   if (!rl.allowed) return rl.response;
 *
 * Compose multiple buckets per request (per-IP + per-user) by calling rateLimit
 * twice with different `id`s.
 */

const UPSTASH_URL = Deno.env.get('UPSTASH_REDIS_REST_URL') ?? '';
const UPSTASH_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') ?? '';

export interface RateLimitOptions {
  /** Logical bucket name (e.g. 'inspection-submit'). Combined with the
   *  caller identifier to form the Redis key. */
  id: string;
  /** Max number of requests allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Override the caller identifier (default = client IP via x-forwarded-for). */
  identifier?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Calls remaining in the window. Approximate when degraded. */
  remaining: number;
  /** Wall-clock seconds until the window rolls. */
  reset: number;
  /** True when Upstash isn't configured — we let the request through. */
  degraded?: boolean;
  /** Pre-baked 429 Response when not allowed. Use directly from the handler. */
  response?: Response;
}

const baseCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

/**
 * Resolve the caller identifier. Prefer the JWT sub (logged-in user) when
 * present, fall back to the client IP. Anonymous floods are limited by IP;
 * authenticated abuse is limited per-user.
 */
function resolveIdentifier(req: Request, override?: string): string {
  if (override) return override;
  const auth = req.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) {
    // Cheap JWT sub extraction — no signature check, just for keying.
    try {
      const payload = auth.slice(7).split('.')[1];
      const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      if (json?.sub) return `u:${json.sub}`;
    } catch {
      /* malformed — fall through to IP */
    }
  }
  const xff = req.headers.get('x-forwarded-for') ?? '';
  const ip = xff.split(',')[0]?.trim();
  return `ip:${ip || 'unknown'}`;
}

export async function rateLimit(
  req: Request,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return { allowed: true, remaining: opts.limit, reset: opts.windowSeconds, degraded: true };
  }

  const identifier = resolveIdentifier(req, opts.identifier);
  const window = Math.floor(Date.now() / 1000 / opts.windowSeconds);
  const key = `rl:${opts.id}:${identifier}:${window}`;

  // Atomic INCR + (conditional) EXPIRE via the pipeline endpoint. The
  // pipeline runs both commands server-side; the EXPIRE is a no-op if the
  // key already has a TTL, so it's safe to send every time.
  let count: number;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(opts.windowSeconds), 'NX'],
      ]),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const body = (await res.json()) as Array<{ result: number } | { error: string }>;
    const first = body[0];
    if (!first || 'error' in first) throw new Error(JSON.stringify(first));
    count = first.result;
  } catch (err) {
    console.warn('[rateLimit] upstash unreachable, allowing request', err);
    return { allowed: true, remaining: opts.limit, reset: opts.windowSeconds, degraded: true };
  }

  const remaining = Math.max(opts.limit - count, 0);
  const reset = opts.windowSeconds - (Math.floor(Date.now() / 1000) % opts.windowSeconds);

  if (count > opts.limit) {
    const response = new Response(
      JSON.stringify({
        error: 'rate_limited',
        bucket: opts.id,
        retry_after_seconds: reset,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(reset),
          'X-RateLimit-Limit': String(opts.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(reset),
          ...baseCorsHeaders,
        },
      },
    );
    return { allowed: false, remaining: 0, reset, response };
  }

  return { allowed: true, remaining, reset };
}
