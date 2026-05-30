#!/usr/bin/env node
/**
 * Reads .mcp-call-<slug>.json via fs.readFileSync (UTF-8) and prints
 * deploy_edge_function arguments as one JSON line on stdout (for MCP tooling).
 */
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) {
  process.stderr.write('Usage: node scripts/fire-mcp-deploy.cjs <export-csv|supervisor-otp>\n');
  process.exit(1);
}

const file = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(file, 'utf8'));
process.stdout.write(JSON.stringify(args));
