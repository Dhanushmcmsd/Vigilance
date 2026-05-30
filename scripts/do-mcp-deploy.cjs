#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/do-mcp-deploy.cjs <export-csv|supervisor-otp>');
  process.exit(1);
}

const file = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(file, 'utf8'));

const index = args.files.find((f) => f.name === 'index.ts');
if (!index) {
  console.error('missing index.ts in payload');
  process.exit(1);
}
if (/PLACEHOLDER/i.test(index.content)) {
  console.error('refusing deploy: PLACEHOLDER in index.ts');
  process.exit(1);
}

const outIdx = process.argv.indexOf('--out');
if (outIdx !== -1 && process.argv[outIdx + 1]) {
  fs.writeFileSync(process.argv[outIdx + 1], JSON.stringify(args), { encoding: 'utf8' });
  console.log(JSON.stringify({ ok: true, wrote: process.argv[outIdx + 1], name: args.name }));
} else {
  process.stdout.write(JSON.stringify(args));
}
