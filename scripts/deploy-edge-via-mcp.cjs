/**
 * Reads .mcp-call-<slug>.json via fs.readFileSync (UTF-8) and prints deploy args.
 * Agent: pass printed JSON to CallMcpTool(user-supabase, deploy_edge_function, args).
 */
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
const file = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(file, 'utf8'));
process.stdout.write(JSON.stringify(args));
