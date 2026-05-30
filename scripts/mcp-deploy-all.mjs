/**
 * Reads deploy bundles and prints one JSON line per function for MCP deploy_edge_function.
 * Usage: node scripts/mcp-deploy-all.mjs
 */
import fs from 'node:fs';

const names = [
  'health-check',
  'notify-officer',
  'admin-create-user',
  'on-inspection-submit',
  'red-alert',
  'export-csv',
  'weekly-report',
];

for (const name of names) {
  const path = `scripts/.deploy-${name}.json`;
  if (!fs.existsSync(path)) {
    console.log(JSON.stringify({ name, error: `missing ${path}` }));
    continue;
  }
  const payload = JSON.parse(fs.readFileSync(path, 'utf8'));
  console.log(
    JSON.stringify({
      name: payload.name,
      entrypoint_path: payload.entrypoint_path,
      verify_jwt: payload.verify_jwt,
      files: payload.files,
    }),
  );
}
