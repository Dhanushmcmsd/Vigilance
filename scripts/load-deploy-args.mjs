/**
 * Load deploy args from .deploy-{name}.json for MCP deploy_edge_function.
 * Usage: node scripts/load-deploy-args.mjs <function-name>
 */
import fs from 'node:fs';

const fn = process.argv[2];
if (!fn) {
  console.error('Usage: node scripts/load-deploy-args.mjs <function-name>');
  process.exit(1);
}

const path = `scripts/.deploy-${fn}.json`;
if (!fs.existsSync(path)) {
  console.error(`Missing ${path}`);
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
