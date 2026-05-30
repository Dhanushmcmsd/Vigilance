const fs = require('fs');
const path = require('path');

const invokePath = path.resolve(process.argv[2]);
const outPath = path.resolve(process.argv[3] || path.join('scripts', '.mcp-result.json'));

const args = JSON.parse(fs.readFileSync(invokePath, 'utf8'));
const deployArgs = {
  name: args.name,
  entrypoint_path: args.entrypoint_path,
  verify_jwt: args.verify_jwt,
  files: args.files,
};

fs.writeFileSync(outPath, JSON.stringify(deployArgs), 'utf8');
console.log(JSON.stringify({ name: deployArgs.name, bytes: Buffer.byteLength(JSON.stringify(deployArgs)), outPath }));
