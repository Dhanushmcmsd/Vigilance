/*
 * Prints MCP deploy args from .deploy-{slug}.json for manual MCP calls.
 * --all flag loops all available .deploy-*.json files.
 * This does NOT deploy — outputs args for Cursor MCP tool use only.
 * Usage: node scripts/mcp-deploy-one.mjs <slug>
 *        node scripts/mcp-deploy-one.mjs --all
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];

const ALL_SLUGS = [
  'health-check',
  'notify-officer',
  'admin-create-user',
  'admin-update-user',
  'on-inspection-submit',
  'red-alert',
  'export-csv',
  'weekly-report',
];

function printArgs(slug) {
  const bundlePath = path.join(__dirname, `.deploy-${slug}.json`);
  if (!fs.existsSync(bundlePath)) {
    console.log(JSON.stringify({ name: slug, error: `missing ${bundlePath}` }));
    return false;
  }
  const payload = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  console.log(
    JSON.stringify({
      name: payload.name,
      entrypoint_path: payload.entrypoint_path,
      verify_jwt: payload.verify_jwt,
      files: payload.files,
    }),
  );
  return true;
}

if (!arg) {
  console.error('Usage: node scripts/mcp-deploy-one.mjs <slug> | --all');
  process.exit(1);
}

if (arg === '--all') {
  for (const slug of ALL_SLUGS) {
    printArgs(slug);
  }
  process.exit(0);
}

const ok = printArgs(arg);
if (!ok) {
  console.error(`Run: npm run functions:bundle ${arg}`);
  process.exit(1);
}
