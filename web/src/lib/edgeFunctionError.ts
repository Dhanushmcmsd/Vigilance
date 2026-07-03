/** Extract a human-readable message from a Supabase Edge Function invoke error. */
export async function parseEdgeFunctionError(err: unknown): Promise<string> {
  if (err && typeof err === 'object') {
    const fnErr = err as { message?: string; context?: Response };
    if (fnErr.context && typeof fnErr.context.json === 'function') {
      try {
        const body = (await fnErr.context.json()) as { error?: string };
        if (body?.error) return body.error;
      } catch {
        /* response body not JSON */
      }
    }
    if (fnErr.message && !fnErr.message.includes('non-2xx')) {
      return fnErr.message;
    }
    if (fnErr.message?.includes('non-2xx')) {
      return 'Server rejected the request. Ensure admin-create-user and admin-update-user edge functions are deployed, then try again.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Request failed.';
}
