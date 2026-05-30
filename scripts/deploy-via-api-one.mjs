/**
 * Deploy one edge function via Supabase Management API.
 * Usage: SUPABASE_ACCESS_TOKEN=... node scripts/deploy-via-api-one.mjs <function-name>
 */
import fs from 'node:fs';

const PROJECT_REF = 'itxfffjepcdfhuzsrnwf';
const fn = process.argv[2];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!fn) {
  console.error('Usage: SUPABASE_ACCESS_TOKEN=... node scripts/deploy-via-api-one.mjs <function-name>');
  process.exit(1);
}

const argsPath = `scripts/.mcp-args-${fn}.json`;
if (!fs.existsSync(argsPath)) {
  console.error(`Missing ${argsPath}`);
  process.exit(1);
}

const args = JSON.parse(fs.readFileSync(argsPath, 'utf8'));

if (!TOKEN) {
  console.log(JSON.stringify({ fn, ok: false, error: 'Missing SUPABASE_ACCESS_TOKEN' }));
  process.exit(1);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${encodeURIComponent(fn)}`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  },
);

const text = await res.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  data = { raw: text };
}

if (!res.ok) {
  console.log(JSON.stringify({ fn, ok: false, verify_jwt: args.verify_jwt, error: data?.message ?? text }));
  process.exit(1);
}

console.log(
  JSON.stringify({
    fn,
    ok: true,
    verify_jwt: args.verify_jwt,
    status: data.status ?? 'ACTIVE',
    version: data.version,
  }),
);
