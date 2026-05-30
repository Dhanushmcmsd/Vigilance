/**
 * Deploy one edge function via Supabase hosted MCP (same as deploy_edge_function tool).
 * Reads full deploy args from an invoke JSON file using fs.readFileSync (UTF-8).
 *
 * Usage: node scripts/deploy-invoke-mcp.mjs <absolute-invoke-json-path>
 */
import fs from 'node:fs';

const PROJECT_REF = 'itxfffjepcdfhuzsrnwf';
const invokePath = process.argv[2];
if (!invokePath) {
  console.error('Usage: node scripts/deploy-invoke-mcp.mjs <invoke-json-path>');
  process.exit(1);
}

const args = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
const deployArgs = {
  name: args.name,
  entrypoint_path: args.entrypoint_path,
  verify_jwt: args.verify_jwt,
  files: args.files,
};

const mcpUrl = `https://mcp.supabase.com/mcp?project_ref=${PROJECT_REF}`;

const body = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'deploy_edge_function',
    arguments: deployArgs,
  },
};

const res = await fetch(mcpUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  },
  body: JSON.stringify(body),
});

const text = await res.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = { raw: text };
}

if (!res.ok) {
  console.log(
    JSON.stringify({
      name: deployArgs.name,
      ok: false,
      verify_jwt: deployArgs.verify_jwt,
      error: parsed?.error?.message ?? parsed?.message ?? text,
    }),
  );
  process.exit(1);
}

const result = parsed?.result ?? parsed;
console.log(
  JSON.stringify({
    name: deployArgs.name,
    ok: true,
    verify_jwt: deployArgs.verify_jwt,
    status: result?.status ?? result?.content?.[0]?.text ? undefined : 'ACTIVE',
    version: result?.version,
    raw: result,
  }),
);
