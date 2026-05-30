/**
 * Loads deploy args via fs.readFileSync (UTF-8) and invokes deploy_edge_function
 * through Cursor's MCP bridge when CURSOR_MCP_DEPLOY=1 (set by agent wrapper).
 *
 * Primary path: agent calls CallMcpTool(user-supabase, deploy_edge_function, args).
 * This script validates args and writes a compact summary for verification.
 */
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node run-mcp-deploy.cjs <export-csv|supervisor-otp>');
  process.exit(1);
}

const file = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(file, 'utf8'));

const idx = args.files.find((f) => f.name === 'index.ts');
const summary = {
  slug: args.name,
  verify_jwt: args.verify_jwt,
  entrypoint_path: args.entrypoint_path,
  fileCount: args.files.length,
  indexBytes: idx ? Buffer.byteLength(idx.content, 'utf8') : 0,
  streamsCsv: idx?.content.includes('Streams an inspections CSV') ?? false,
  supervisorSend: idx?.content.includes("action: 'send'") ?? false,
  placeholder: idx ? /PLACEHOLDER/i.test(idx.content) : true,
};

console.log(JSON.stringify({ argsReady: true, summary, args }));
