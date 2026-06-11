import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function renderStartupError(missing: string[]): void {
  const safeMissing = missing.map((k) => k.replace(/[^A-Z0-9_]/gi, '')).join(', ');
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 640px; margin: 60px auto; padding: 32px; border: 1px solid #fecaca; background: #fef2f2; border-radius: 12px; color: #7f1d1d;">
      <h1 style="margin: 0 0 12px 0; font-size: 20px;">Vigilance dashboard cannot start</h1>
      <p style="margin: 0 0 8px 0;">Missing required environment variables: <strong>${safeMissing}</strong>.</p>
      <p style="margin: 0 0 12px 0;">In local dev, copy <code>web/.env.example</code> to <code>web/.env</code> and fill it in. In Vercel, add the keys under <em>Project Settings → Environment Variables</em> and redeploy.</p>
      <p style="margin: 0; font-size: 13px; color: #991b1b;">Find the values at <code>https://supabase.com/dashboard/project/&lt;ref&gt;/settings/api</code>.</p>
    </div>
  `;
  if (typeof document !== 'undefined') {
    const root = document.getElementById('root');
    if (root) root.innerHTML = html;
    else document.body.innerHTML = html;
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (import.meta.env.DEV) {
    console.error(
      `[supabase] Missing environment variables: ${missing.join(', ')}. ` +
        'See web/.env.example for setup instructions.',
    );
  }
  renderStartupError(missing);
  throw new Error(
    `Missing Supabase environment variables: ${missing.join(', ')}. ` +
      'See web/.env.example for setup instructions.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
