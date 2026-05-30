/**
 * Deploy remaining edge functions by reading .mcp-args-*.json and calling
 * Supabase Management API (same endpoint as MCP deploy_edge_function).
 * Requires SUPABASE_ACCESS_TOKEN.
 *
 * Usage: node scripts/deploy-remaining.mjs
 */
import fs from 'node:fs';

const PROJECT_REF = 'itxfffjepcdfhuzsrnwf';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const NAMES = ['export-csv', 'on-inspection-submit'];

async function deploy(fn) {
  const path = `scripts/.mcp-args-${fn}.json`;
  const args = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!TOKEN) {
    return { fn, ok: false, verify_jwt: args.verify_jwt, error: 'Missing SUPABASE_ACCESS_TOKEN' };
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
    return { fn, ok: false, verify_jwt: args.verify_jwt, error: data?.message ?? text };
  }
  return {
    fn,
    ok: true,
    verify_jwt: args.verify_jwt,
    status: data.status ?? 'ACTIVE',
    version: data.version,
  };
}

const results = [];
for (const fn of NAMES) {
  results.push(await deploy(fn));
}
for (const r of results) {
  console.log(JSON.stringify(r));
}
