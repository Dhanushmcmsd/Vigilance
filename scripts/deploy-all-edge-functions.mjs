/*
 * Batch deploys all 8 edge functions via Management API sequentially.
 * Requires all .deploy-{slug}.json bundles to exist first.
 * Requires: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF in env.
 * Usage: node scripts/deploy-all-edge-functions.mjs
 * Note: redeploys everything — not incremental.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'itxfffjepcdfhuzsrnwf';
const token = process.env.SUPABASE_ACCESS_TOKEN;

const slugs = [
  'health-check',
  'notify-officer',
  'admin-create-user',
  'admin-update-user',
  'on-inspection-submit',
  'red-alert',
  'export-csv',
  'weekly-report',
];

if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

async function deploy(slug) {
  const bundlePath = path.join(__dirname, `.deploy-${slug}.json`);
  if (!fs.existsSync(bundlePath)) {
    return { name: slug, ok: false, error: `missing ${bundlePath}` };
  }
  const payload = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const body = {
    name: payload.name,
    entrypoint_path: payload.entrypoint_path,
    verify_jwt: payload.verify_jwt,
    files: payload.files,
  };

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=${encodeURIComponent(slug)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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
    return { name: slug, ok: false, verify_jwt: payload.verify_jwt, error: data?.message ?? text };
  }
  return {
    name: slug,
    ok: true,
    verify_jwt: payload.verify_jwt,
    status: data.status ?? 'ACTIVE',
    version: data.version,
  };
}

for (const slug of slugs) {
  console.log(JSON.stringify(await deploy(slug)));
}
