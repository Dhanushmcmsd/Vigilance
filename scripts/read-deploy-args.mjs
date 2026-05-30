/**
 * Reads .deploy-{name}.json and prints deploy args for MCP.
 * Usage: node scripts/read-deploy-args.mjs <name>
 */
import fs from 'node:fs';

const name = process.argv[2];
const path = `scripts/.deploy-${name}.json`;
const payload = JSON.parse(fs.readFileSync(path, 'utf8'));
process.stdout.write(
  JSON.stringify({
    name: payload.name,
    entrypoint_path: payload.entrypoint_path,
    verify_jwt: payload.verify_jwt,
    files: payload.files,
  }),
);
