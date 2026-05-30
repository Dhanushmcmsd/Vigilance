#!/usr/bin/env node
/**
 * Deploy edge function via Supabase MCP HTTP (project_ref in URL).
 * Reads .mcp-call-<slug>.json with fs.readFileSync UTF-8.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/run-mcp-deploy-http.mjs <export-csv|supervisor-otp>');
  process.exit(1);
}

const argsPath = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(argsPath, 'utf8'));

const MCP_URL = 'https://mcp.supabase.com/mcp?project_ref=itxfffjepcdfhuzsrnwf';

async function mcpCall(toolName, toolArgs) {
  const initRes = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'vigilance-deploy', version: '1.0.0' },
      },
    }),
  });
  const initText = await initRes.text();
  if (!initRes.ok) {
    throw new Error(`initialize failed ${initRes.status}: ${initText.slice(0, 500)}`);
  }

  const callRes = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: toolName, arguments: toolArgs },
    }),
  });
  const callText = await callRes.text();
  if (!callRes.ok) {
    throw new Error(`tools/call failed ${callRes.status}: ${callText.slice(0, 500)}`);
  }
  return callText;
}

try {
  const result = await mcpCall('deploy_edge_function', args);
  console.log(result);
} catch (e) {
  console.error(JSON.stringify({ error: String(e) }));
  process.exit(1);
}
