/**
 * Prints MCP deploy_edge_function args JSON for one function (stdout, UTF-8).
 * Usage: node scripts/mcp-deploy-from-args.mjs <function-name>
 */
import fs from 'node:fs';

const fn = process.argv[2];
if (!fn) {
  console.error('Usage: node scripts/mcp-deploy-from-args.mjs <function-name>');
  process.exit(1);
}

const path = `scripts/.mcp-args-${fn}.json`;
if (!fs.existsSync(path)) {
  console.error(`Missing ${path}`);
  process.exit(1);
}

const args = JSON.parse(fs.readFileSync(path, 'utf8'));
process.stdout.write(JSON.stringify(args));
