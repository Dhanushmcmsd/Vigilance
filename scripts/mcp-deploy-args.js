#!/usr/bin/env node
/**
 * Reads .mcp-call-<slug>.json and prints deploy_edge_function arguments (UTF-8).
 * Usage: node scripts/mcp-deploy-args.js export-csv
 */
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/mcp-deploy-args.js <export-csv|supervisor-otp>');
  process.exit(1);
}

const file = path.join(__dirname, `.mcp-call-${slug}.json`);
const raw = fs.readFileSync(file, 'utf8');
const payload = JSON.parse(raw);

if (!payload.name || !payload.files?.length) {
  console.error('Invalid payload in', file);
  process.exit(1);
}

process.stdout.write(JSON.stringify(payload));
