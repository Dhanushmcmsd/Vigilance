# Scripts

Edge function deployment and maintenance scripts.
All commands run from the project root via npm.

## Commands

| Command | Does |
|---------|------|
| `npm run functions:bundle` | Bundle one fn + `_shared` into `.deploy-{slug}.json` |
| `npm run functions:validate` | Validate `.deploy-*.json` bundles before deploy |
| `npm run functions:clean` | Remove `.deploy-*` and `.mcp-*` artifacts from `scripts/` |
| `npm run functions:deploy:cli` | Deploy all via Supabase CLI (needs `supabase login`) |
| `npm run functions:deploy:one` | Deploy single fn via Management API |
| `npm run functions:deploy:all` | Deploy all 8 fns via Management API sequentially |

## Standard Deploy Flow (API path)

Used when Supabase CLI auth is unavailable:

1. `npm run functions:bundle <slug>`
2. `npm run functions:validate <slug>`
3. `npm run functions:deploy:one <slug>`
4. `npm run functions:clean`

Full redeploy: bundle + validate all, then `functions:deploy:all`, then clean.

## CLI Deploy Flow

```bash
supabase functions deploy           # all
supabase functions deploy <slug>    # one
```

Requires `supabase login` or `SUPABASE_ACCESS_TOKEN` in env.

## Edge Functions

| Slug | Purpose |
|------|---------|
| `admin-create-user` | Provision auth user + user_roles (rate-limited) |
| `admin-update-user` | Update credentials & profile (rate-limited) |
| `export-csv` | Stream paginated inspections CSV (RLS-enforced) |
| `health-check` | Liveness probe for uptime monitors |
| `notify-officer` | Push + email for assignments & approvals |
| `on-inspection-submit` | Email management on submit; urgent on red risk |
| `red-alert` | Escalation emails; logs to notification_log |
| `weekly-report` | Monday 08:00 IST compliance digest to mgmt |

## Database Migrations

```bash
supabase db push          # apply pending to production
supabase db diff          # preview before pushing
supabase migration list   # check applied vs pending
```

54 migration files in `supabase/migrations/`.
Never edit applied migrations — add new files for schema changes.

## Mobile Builds (Expo EAS)

OTA update (JS/asset changes only — no reinstall):

```bash
eas update --branch production --message "description"
```

Full APK (native changes or new permissions):

```bash
eas build --platform android --profile production
```

Preview build (internal testing):

```bash
eas build --platform android --profile preview
```

## Required Environment Variables

Deploy scripts:

- `SUPABASE_ACCESS_TOKEN` — personal access token (supabase.com/account/tokens)
- `SUPABASE_PROJECT_REF` — project ref from dashboard settings

Edge function runtime secrets (set in Supabase dashboard):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
