# Deploy helper scripts

## Bundle an edge function (UTF-8 safe)

```bash
node scripts/bundle-edge-function.mjs export-csv scripts/.deploy-export-csv.json
node scripts/mcp-deploy-one.mjs export-csv   # prints args JSON to stdout
```

Deploy with Supabase MCP `deploy_edge_function` using the bundle JSON, or:

```bash
npx supabase functions deploy export-csv --project-ref itxfffjepcdfhuzsrnwf
```

## Validate & clean

```bash
node scripts/clean-deploy-artifacts.mjs
node scripts/bundle-edge-function.mjs export-csv scripts/.deploy-export-csv.json
node scripts/validate-mcp-payloads.cjs export-csv
```

## Do not

- Commit files matching `scripts/.deploy*`, `scripts/.mcp-*`, `scripts/.last-*`, etc. (gitignored).
- Generate bundle JSON with PowerShell `ConvertTo-Json` or `Set-Content` — it corrupts em-dashes (`—`) into `?`, which breaks JSON and blocks deploys.

## Email secrets

All Resend-sending functions use **`RESEND_FROM`** (and optionally legacy **`ALERTS_FROM`**): `notify-officer`, `on-inspection-submit`, `red-alert`.
