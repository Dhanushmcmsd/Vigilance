/**
 * Prints deploy_edge_function arguments JSON for one function.
 * Usage: node scripts/mcp-deploy-one.mjs <function-name>
 */
import fs from 'node:fs';

const fn = process.argv[2];
if (!fn) {
  console.error('Usage: node scripts/mcp-deploy-one.mjs <function-name>');
  process.exit(1);
}

const path = `scripts/.deploy-${fn}.json`;
if (!fs.existsSync(path)) {
  console.error(`Missing ${path} — run: node scripts/bundle-edge-function.mjs ${fn} ${path}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(path, 'utf8'));
const args = {
  name: payload.name,
  entrypoint_path: payload.entrypoint_path,
  verify_jwt: payload.verify_jwt,
  files: payload.files,
};
process.stdout.write(JSON.stringify(args));
