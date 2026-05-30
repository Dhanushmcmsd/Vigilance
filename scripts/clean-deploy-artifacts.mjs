/**
 * Remove generated deploy/MCP bundle files under scripts/.
 * Safe to run anytime — regenerate with bundle-edge-function.mjs after.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const PREFIXES = [
  '.bundle-',
  '.call-',
  '.deploy',
  '.invoke-',
  '.last-',
  '.mcp-',
  '.pipe-',
  '.result-',
  '.stdout-',
  '.tmp-',
  '.utf8-',
];
const EXACT = new Set([
  'deploy-arguments-export.json',
  'deploy-arguments-supervisor.json',
]);

let removed = 0;
for (const name of fs.readdirSync(dir)) {
  const drop =
    PREFIXES.some((p) => name.startsWith(p)) ||
    EXACT.has(name) ||
    (name.startsWith('deploy-') && name.endsWith('.json') && !name.includes('edge'));
  if (!drop) continue;
  fs.unlinkSync(path.join(dir, name));
  removed++;
  console.log('removed', name);
}
console.log(`Done. Removed ${removed} file(s).`);
