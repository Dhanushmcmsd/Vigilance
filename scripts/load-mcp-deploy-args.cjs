const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node load-mcp-deploy-args.cjs <export-csv|supervisor-otp>');
  process.exit(1);
}

const file = path.join(__dirname, `.mcp-call-${slug}.json`);
const args = JSON.parse(fs.readFileSync(file, 'utf8'));
process.stdout.write(JSON.stringify(args));
