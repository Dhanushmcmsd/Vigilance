#!/usr/bin/env node
/**
 * Loads deploy args from .mcp-call-<slug>.json (UTF-8 via readFileSync)
 * and invokes deploy via @supabase/mcp-server-supabase if available,
 * otherwise prints args path for manual MCP call.
 */
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/mcp-deploy-runner.js <export-csv|supervisor-otp>');
  process.exit(1);
}

const src = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(src, 'utf8'));

async function main() {
  // Cursor agent should use CallMcpTool; this script validates payload.
  const index = args.files.find((f) => f.name === 'index.ts');
  if (!index) throw new Error('missing index.ts');
  const hasPlaceholder = args.files.some((f) => /PLACEHOLDER/i.test(f.content));
  if (hasPlaceholder) throw new Error('payload contains PLACEHOLDER text');

  const markers = {
    'export-csv': 'Streams an inspections CSV',
    'supervisor-otp': "action: 'send'",
  };
  const marker = markers[slug];
  if (marker && !index.content.includes(marker)) {
    throw new Error(`index.ts missing expected marker: ${marker}`);
  }

  const outPath = path.join(__dirname, `.mcp-deploy-ready-${slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(args), { encoding: 'utf8' });
  console.log(JSON.stringify({
    ok: true,
    slug,
    outPath,
    name: args.name,
    verify_jwt: args.verify_jwt,
    fileCount: args.files.length,
    indexBytes: index.content.length,
    markerFound: marker ? index.content.includes(marker) : true,
  }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
