/**
 * Load deploy_edge_function args from an absolute invoke JSON path (UTF-8).
 * Usage: node scripts/mcp-deploy-invoke-path.mjs <absolute-path-to-invoke.json>
 */
import fs from 'node:fs';

const invokePath = process.argv[2];
if (!invokePath) {
  console.error('Usage: node scripts/mcp-deploy-invoke-path.mjs <invoke-json-path>');
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
