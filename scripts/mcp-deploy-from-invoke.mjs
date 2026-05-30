/**
 * Deploy edge functions by reading invoke JSON paths (UTF-8 fs.readFileSync)
 * and writing deploy args for MCP deploy_edge_function (stdout = one JSON object).
 *
 * Usage: node scripts/mcp-deploy-from-invoke.mjs <absolute-invoke-json-path>
 */
import fs from 'node:fs';

const invokePath = process.argv[2];
if (!invokePath) {
  console.error('Usage: node scripts/mcp-deploy-from-invoke.mjs <invoke-json-path>');
  process.exit(1);
}

const args = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
const outPath = process.argv[3];
const payload = JSON.stringify({
  name: args.name,
  entrypoint_path: args.entrypoint_path,
  verify_jwt: args.verify_jwt,
  files: args.files,
});

if (outPath) {
  fs.writeFileSync(outPath, payload, 'utf8');
  console.log(JSON.stringify({ written: outPath, name: args.name, fileCount: args.files.length }));
} else {
  process.stdout.write(payload);
}
