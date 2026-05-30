#!/usr/bin/env node
/**
 * Loads deploy args via fs.readFileSync (UTF-8) from .mcp-call-<slug>.json
 * and prints MCP deploy_edge_function arguments JSON to stdout (for agent CallMcpTool).
 */
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/run-deploy-via-mcp.cjs <export-csv|supervisor-otp>');
  process.exit(1);
}

const file = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(file, 'utf8'));
process.stdout.write(JSON.stringify({ tool: 'deploy_edge_function', arguments: args }));
