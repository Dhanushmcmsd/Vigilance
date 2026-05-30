/**
 * Deploy edge functions by reading .deploy-*.json bundles.
 * Prints JSON results for each function to stdout (one line per function).
 * Used with MCP deploy_edge_function - this script only validates bundles.
 */
import fs from 'node:fs';

const fn = process.argv[2];
if (!fn) {
  console.error('Usage: node scripts/mcp-deploy-via-node.mjs <function-name>');
  process.exit(1);
}

const path = `scripts/.deploy-${fn}.json`;
if (!fs.existsSync(path)) {
  console.log(JSON.stringify({ fn, ok: false, error: `missing ${path}` }));
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(path, 'utf8'));
process.stdout.write(
  JSON.stringify({
    name: payload.name,
    entrypoint_path: payload.entrypoint_path,
    verify_jwt: payload.verify_jwt,
    files: payload.files,
  }),
);
