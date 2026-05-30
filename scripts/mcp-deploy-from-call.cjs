#!/usr/bin/env node
/**
 * Loads deploy args via fs.readFileSync (UTF-8) from .mcp-call-<slug>.json
 * and writes deploy-ready JSON for agent CallMcpTool (stdout = args only).
 */
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
const out = process.argv[3];
if (!slug) {
  console.error('Usage: node scripts/mcp-deploy-from-call.cjs <export-csv|supervisor-otp> [out.json]');
  process.exit(1);
}

const file = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(file, 'utf8'));
const json = JSON.stringify(args);
if (out) {
  fs.writeFileSync(out, json, { encoding: 'utf8' });
  console.log(JSON.stringify({ ok: true, wrote: out, name: args.name, bytes: json.length }));
} else {
  process.stdout.write(json);
}
