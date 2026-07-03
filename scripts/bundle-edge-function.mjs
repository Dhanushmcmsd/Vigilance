/*
 * Bundles a single edge function + _shared/ into a deploy-ready JSON.
 * Output: .deploy-{slug}.json in scripts/ — consumed by deploy-edge-function.mjs
 * Usage: node scripts/bundle-edge-function.mjs <function-slug>
 * Note: validates UTF-8 — binary assets will be rejected.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const fnName = process.argv[2];
if (!fnName) {
  console.error('Usage: node scripts/bundle-edge-function.mjs <function-name>');
  process.exit(1);
}

const configToml = fs.readFileSync(path.join(root, 'supabase', 'config.toml'), 'utf8');
const jwtMatch = configToml.match(
  new RegExp(`\\[functions\\.${fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\][\\s\\S]*?verify_jwt\\s*=\\s*(true|false)`, 'i'),
);
const verify_jwt = jwtMatch ? jwtMatch[1] === 'true' : true;

const fnDir = path.join(root, 'supabase', 'functions', fnName);
const indexPath = path.join(fnDir, 'index.ts');
if (!fs.existsSync(indexPath)) {
  console.error(`Missing ${indexPath}`);
  process.exit(1);
}

let indexContent = fs.readFileSync(indexPath, 'utf8');
indexContent = indexContent.replace(
  /from ['"]\.\.\/_shared\/([^'"]+)['"]/g,
  "from './_shared/$1'",
);

const files = [{ name: 'index.ts', content: indexContent }];

const denoJsonPath = path.join(fnDir, 'deno.json');
const import_map_path = fs.existsSync(denoJsonPath) ? 'deno.json' : undefined;
if (import_map_path) {
  files.push({
    name: import_map_path,
    content: fs.readFileSync(denoJsonPath, 'utf8'),
  });
}

const sharedDir = path.join(root, 'supabase', 'functions', '_shared');
const sharedImports = [...indexContent.matchAll(/from ['"]\.\/_shared\/([^'"]+)['"]/g)].map(
  (m) => m[1],
);
for (const rel of [...new Set(sharedImports)]) {
  const sharedPath = path.join(sharedDir, rel);
  if (!fs.existsSync(sharedPath)) {
    console.error(`Missing shared file: ${sharedPath}`);
    process.exit(1);
  }
  files.push({
    name: `_shared/${rel}`,
    content: fs.readFileSync(sharedPath, 'utf8'),
  });
}

const payload = {
  name: fnName,
  entrypoint_path: 'index.ts',
  verify_jwt,
  ...(import_map_path ? { import_map_path } : {}),
  files,
};

/** Detect PowerShell / wrong-codepage corruption (U+FFFD or long ? runs in comments). */
function assertUtf8Bundle(payload) {
  const serialized = JSON.stringify(payload);
  if (/\uFFFD/.test(serialized)) {
    throw new Error('Bundle contains U+FFFD replacement characters — source files may be wrong encoding.');
  }
  for (const file of payload.files) {
    if (/\?{4,}/.test(file.content)) {
      throw new Error(
        `Bundle file "${file.name}" has suspicious ? runs — regenerate with Node only (not PowerShell ConvertTo-Json).`,
      );
    }
  }
}

const outPath = process.argv[3];
if (outPath) {
  assertUtf8Bundle(payload);
  fs.writeFileSync(path.resolve(outPath), JSON.stringify(payload), 'utf8');
} else {
  process.stdout.write(JSON.stringify(payload));
}
