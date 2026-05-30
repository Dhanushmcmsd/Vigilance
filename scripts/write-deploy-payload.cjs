const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
const out = process.argv[3];
if (!slug || !out) {
  console.error('Usage: node write-deploy-payload.cjs <slug> <out.json>');
  process.exit(1);
}

const src = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(src, 'utf8'));
fs.writeFileSync(out, JSON.stringify(args), 'utf8');
console.log('wrote', out, 'bytes', fs.statSync(out).size);
