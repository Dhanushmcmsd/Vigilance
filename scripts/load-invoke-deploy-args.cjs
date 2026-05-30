const fs = require('fs');
const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/load-invoke-deploy-args.cjs <invoke-json-path>');
  process.exit(1);
}
const args = JSON.parse(fs.readFileSync(path, 'utf8'));
process.stdout.write(
  JSON.stringify({
    name: args.name,
    entrypoint_path: args.entrypoint_path,
    verify_jwt: args.verify_jwt,
    files: args.files,
  }),
);
