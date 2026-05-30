/**
 * Emit deploy_edge_function args JSON for MCP (UTF-8 fs.readFileSync).
 * Usage: node scripts/emit-mcp-deploy-args.mjs <absolute-invoke-json-path>
 */
import fs from 'node:fs';

const invokePath = process.argv[2];
if (!invokePath) {
  console.error('Usage: node scripts/emit-mcp-deploy-args.mjs <invoke-json-path>');
  process.exit(1);
}

const args = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
process.stdout.write(
  JSON.stringify({
    name: args.name,
    entrypoint_path: args.entrypoint_path,
    verify_jwt: args.verify_jwt,
    files: args.files,
  }),
);
