#!/usr/bin/env node
/**
 * Reads deploy JSON from stdin (UTF-8), validates, writes marker for agent.
 * Agent must CallMcpTool deploy_edge_function with parsed stdin JSON.
 */
let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  try {
    const args = JSON.parse(data);
    const index = args.files?.find((f) => f.name === 'index.ts');
    if (!index) throw new Error('missing index.ts');
    if (/PLACEHOLDER/i.test(index.content)) throw new Error('PLACEHOLDER in payload');
    require('fs').writeFileSync(
      require('path').join(__dirname, '.deploy-ready.json'),
      JSON.stringify({ ready: true, name: args.name, verify_jwt: args.verify_jwt, marker: index.content.includes('Streams an inspections CSV') || index.content.includes("action: 'send'") }),
      'utf8',
    );
    process.stdout.write(JSON.stringify({ ok: true, name: args.name }));
  } catch (e) {
    process.stderr.write(String(e));
    process.exit(1);
  }
});
