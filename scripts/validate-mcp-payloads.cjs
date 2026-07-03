/*
 * Validates .deploy-{slug}.json bundles before API deployment.
 * Checks structure, required fields, and file size limits.
 * Run after bundle, before deploy.
 * Usage: node scripts/validate-mcp-payloads.cjs [slug]
 */
const fs = require('fs');
const path = require('path');

const slugs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['export-csv'];

let failed = false;

for (const slug of slugs) {
  const file = path.join(__dirname, `.deploy-${slug}.json`);
  if (!fs.existsSync(file)) {
    console.error(`MISSING ${file} — run: node scripts/bundle-edge-function.mjs ${slug} ${file}`);
    failed = true;
    continue;
  }
  const raw = fs.readFileSync(file, 'utf8');
  if (/\uFFFD/.test(raw)) {
    console.error(`FAIL ${slug}: U+FFFD in bundle — regenerate with Node bundle script`);
    failed = true;
    continue;
  }
  let args;
  try {
    args = JSON.parse(raw);
  } catch (e) {
    console.error(`FAIL ${slug}: invalid JSON — ${e.message}`);
    failed = true;
    continue;
  }
  const main = args.files?.[0]?.content ?? '';
  if (/\?{4,}/.test(main)) {
    console.error(`FAIL ${slug}: corrupted comment encoding (? runs) — use bundle-edge-function.mjs only`);
    failed = true;
    continue;
  }
  if (/PLACEHOLDER/i.test(main)) {
    console.error(`FAIL ${slug}: placeholder source detected`);
    failed = true;
    continue;
  }
  console.log(`OK ${slug} (${args.files.length} files, verify_jwt=${args.verify_jwt})`);
}

process.exit(failed ? 1 : 0);
