const fs = require('fs');
const path = require('path');

const slug = process.argv[2];
const root = path.join(__dirname, '..', 'supabase', 'functions');

const fnDir = path.join(root, slug);
const indexPath = path.join(fnDir, 'index.ts');
const ratePath = path.join(root, '_shared', 'rateLimit.ts');

if (!fs.existsSync(indexPath)) {
  console.error('Missing', indexPath);
  process.exit(1);
}

const args = {
  name: slug,
  entrypoint_path: 'index.ts',
  verify_jwt: true,
  files: [
    { name: 'index.ts', content: fs.readFileSync(indexPath, 'utf8') },
    { name: '_shared/rateLimit.ts', content: fs.readFileSync(ratePath, 'utf8') },
  ],
};

if (slug === 'supervisor-otp') {
  args.files[0].content = args.files[0].content.replace(
    "from '../_shared/rateLimit.ts'",
    "from './_shared/rateLimit.ts'",
  );
}

const out = path.join(__dirname, `.mcp-call-${slug}.json`);
fs.writeFileSync(out, JSON.stringify(args), 'utf8');
process.stdout.write(JSON.stringify(args));
