/**
 * Verified sender for Resend — use RESEND_FROM in Supabase Edge secrets.
 * ALERTS_FROM is a legacy alias only.
 */
export function resolveResendFrom(fallback = 'VMS Alerts <alerts@vigilancems.app>'): string {
  return Deno.env.get('RESEND_FROM') ?? Deno.env.get('ALERTS_FROM') ?? fallback;
}
