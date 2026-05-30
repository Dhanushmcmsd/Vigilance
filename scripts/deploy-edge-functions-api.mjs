/**
 * Deploy all edge functions via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN env var (same token used by MCP).
 * Usage: SUPABASE_ACCESS_TOKEN=... node scripts/deploy-edge-functions-api.mjs
 */
import fs from 'node:fs';

const PROJECT_REF = 'itxfffjepcdfhuzsrnwf';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

const NAMES = [
  'health-check',
  'notify-officer',
  'admin-create-user',
  'on-inspection-submit',
  'red-alert',
  'export-csv',
  'supervisor-otp',
  'weekly-report',
];

if (!TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

async function deploy(name) {
  const path = `scripts/.deploy-${name}.json`;
  if (!fs.existsSync(path)) {
    return { name, ok: false, error: `missing ${path}` };
  }
  const payload = JSON.parse(fs.readFileSync(path, 'utf8'));
  const body = {
    name: payload.name,
    entrypoint_path: payload.entrypoint_path,
    verify_jwt: payload.verify_jwt,
    files: payload.files,
  };

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    return { name, ok: false, verify_jwt: payload.verify_jwt, error: data?.message ?? text };
  }
  return {
    name,
    ok: true,
    verify_jwt: payload.verify_jwt,
    status: data.status ?? 'ACTIVE',
    version: data.version,
  };
}

const results = [];
for (const name of NAMES) {
  const r = await deploy(name);
  results.push(r);
  console.log(JSON.stringify(r));
}
