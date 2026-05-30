/**
 * Deploy one edge function via Supabase Management API using invoke JSON args.
 * Reads deploy args with fs.readFileSync (UTF-8) — same payload as MCP deploy_edge_function.
 *
 * Usage: node scripts/deploy-invoke-api.mjs <absolute-invoke-json-path>
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECT_REF = 'itxfffjepcdfhuzsrnwf';
const invokePath = process.argv[2];

if (!invokePath) {
  console.error('Usage: node scripts/deploy-invoke-api.mjs <invoke-json-path>');
  process.exit(1);
}

function resolveToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  const candidates = [
    path.join(os.homedir(), '.cursor', 'supabase-access-token'),
    path.join(os.homedir(), '.supabase', 'access-token'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const t = fs.readFileSync(p, 'utf8').trim();
      if (t) return t;
    }
  }
  return null;
}

const args = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
const deployArgs = {
  name: args.name,
  entrypoint_path: args.entrypoint_path,
  verify_jwt: args.verify_jwt,
  files: args.files,
};

const TOKEN = resolveToken();
if (!TOKEN) {
  console.log(
    JSON.stringify({
      name: deployArgs.name,
      ok: false,
      verify_jwt: deployArgs.verify_jwt,
      error: 'Missing SUPABASE_ACCESS_TOKEN',
      use_mcp: true,
    }),
  );
  process.exit(2);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${encodeURIComponent(deployArgs.name)}`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
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
