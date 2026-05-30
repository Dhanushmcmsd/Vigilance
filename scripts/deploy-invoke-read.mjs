/**
 * Read deploy_edge_function args from an invoke JSON path (UTF-8 via fs.readFileSync).
 * Usage: node scripts/deploy-invoke-read.mjs <absolute-invoke-json-path>
 */
import fs from 'node:fs';

const invokePath = process.argv[2];
if (!invokePath) {
  console.error('Usage: node scripts/deploy-invoke-read.mjs <invoke-json-path>');
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
