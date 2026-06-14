/*
 * Deploys a single edge function to Supabase via Management API.
 * Reads from .deploy-{slug}.json — run bundle + validate first.
 * Requires: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF in env.
 * Usage: node scripts/deploy-edge-function.mjs <function-slug>
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2];
const projectRef = process.env.SUPABASE_PROJECT_REF ?? 'itxfffjepcdfhuzsrnwf';

if (!slug) {
  console.error('Usage: node scripts/deploy-edge-function.mjs <function-slug>');
  process.exit(1);
}

function resolveToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  for (const p of [
    path.join(os.homedir(), '.cursor', 'supabase-access-token'),
    path.join(os.homedir(), '.supabase', 'access-token'),
  ]) {
    if (fs.existsSync(p)) {
      const t = fs.readFileSync(p, 'utf8').trim();
      if (t) return t;
    }
  }
  return null;
}

const bundlePath = path.join(__dirname, `.deploy-${slug}.json`);
if (!fs.existsSync(bundlePath)) {
  console.error(`Missing ${bundlePath} — run: npm run functions:bundle ${slug}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
const deployArgs = {
  name: payload.name,
  entrypoint_path: payload.entrypoint_path,
  verify_jwt: payload.verify_jwt,
  files: payload.files,
};

const token = resolveToken();
if (!token) {
  console.log(
    JSON.stringify({
      name: deployArgs.name,
      ok: false,
      verify_jwt: deployArgs.verify_jwt,
      error: 'Missing SUPABASE_ACCESS_TOKEN',
    }),
  );
  process.exit(2);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/functions/deploy?slug=${encodeURIComponent(deployArgs.name)}`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(deployArgs),
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
  console.log(
    JSON.stringify({
      name: deployArgs.name,
      ok: false,
      verify_jwt: deployArgs.verify_jwt,
      error: data?.message ?? text,
    }),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    name: deployArgs.name,
    ok: true,
    verify_jwt: deployArgs.verify_jwt,
    status: data.status ?? 'ACTIVE',
    version: data.version,
    slug: data.slug,
    id: data.id,
  }),
);
