/**
 * Reads deploy JSON (UTF-8) and prints MCP deploy_edge_function arguments to stdout.
 * Agent uses output with CallMcpTool deploy_edge_function.
 *
 * Usage: node scripts/run-mcp-deploy-from-json.mjs <deploy-json-path>
 */
import fs from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/run-mcp-deploy-from-json.mjs <deploy-json-path>');
  process.exit(1);
}

const args = JSON.parse(fs.readFileSync(path, 'utf8'));
process.stdout.write(
  JSON.stringify({
    name: args.name,
    entrypoint_path: args.entrypoint_path,
    verify_jwt: args.verify_jwt,
    files: args.files,
  }),
);
