# Vigilance Management System — Security Runbook

Operational checklist for keeping the Supabase + Vercel + Expo deployment
secure. Sections marked **[OPERATOR ACTION REQUIRED]** can't be done from
this repo — they're dashboard or CLI steps you need to execute by hand.

---

## 1. Rotate Supabase keys (do this first)

The repository previously tracked `web/.env.production` and `mobile/.env`.
Those files have been removed from the git index in the same commit that
introduced this runbook, but **the values inside them are still considered
compromised** because git history retains every blob.

**[OPERATOR ACTION REQUIRED]**

1. Open Supabase Dashboard → **Project Settings → API**.
2. Click **Reset** next to both keys:
   - `anon (public)` key — used by both apps.
   - `service_role` key — used by edge functions.
3. Re-set the corresponding env vars:
   ```bash
   # Edge functions (server-side)
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new_value>
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set UPSTASH_REDIS_REST_URL=https://...
   supabase secrets set UPSTASH_REDIS_REST_TOKEN=...

   # Web (Vercel)
   vercel env add VITE_SUPABASE_URL          production
   vercel env add VITE_SUPABASE_ANON_KEY     production

   # Mobile (EAS or local .env — never commit)
   echo "EXPO_PUBLIC_SUPABASE_URL=https://...supabase.co"        >  mobile/.env
   echo "EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ..."                   >> mobile/.env
   ```
4. Trigger redeploys (Vercel) / new EAS build (mobile).
5. **Optional but recommended:** purge the leaked blobs from git history
   (`git filter-repo --path web/.env.production --invert-paths`) and
   force-push. This breaks every existing clone, so coordinate with the
   team first.

---

## 2. Disable public sign-ups

Already enforced in **three places** so a misconfigured dashboard can't
re-open the hole accidentally:

| Layer | Mechanism |
|---|---|
| Supabase project | `supabase/config.toml` → `[auth] enable_signup = false` and `[auth.email] enable_signup = false`. Push with `supabase config push`. |
| Mobile app | `mobile/app/(auth)/` only ships `login.tsx` + `forgot-password.tsx` — no sign-up screen exists. |
| Web dashboard | `web/src/pages/Login.tsx` only renders sign-in. No call to `supabase.auth.signUp`. |

**[OPERATOR ACTION REQUIRED]**

Confirm in the Supabase dashboard:
- Authentication → Providers → Email → **Enable sign-ups** is OFF.
- Authentication → Providers → Phone → **Enable sign-ups** is OFF.

Officers, heads, management, and admin accounts are provisioned exclusively
from the Admin Panel (which calls `supabase.auth.admin.inviteUserByEmail`).

---

## 3. JWT expiry + refresh-token rotation

Set in `supabase/config.toml`:

```toml
[auth]
jwt_expiry = 3600                          # 1h access token
refresh_token_rotation_enabled = true      # rotate on every refresh
refresh_token_reuse_interval = 10          # 10s grace for slow networks
```

Push with `supabase config push` after rotating keys. If reuse is detected
after the grace window, Supabase invalidates the entire refresh chain — an
attacker holding a stolen refresh token gets locked out the moment the
legitimate user's app refreshes once.

**Client-side verification:**

| App | Storage backend | File |
|---|---|---|
| Mobile | `LargeSecureStore` (chunked `expo-secure-store`, Keychain on iOS / KeyStore on Android) | `mobile/lib/supabase.ts` |
| Web | Browser `localStorage` (Supabase default) | `web/src/lib/supabase.ts` |

The mobile client already passes `storage: secureStore` + `autoRefreshToken: true`
to `createClient`. No change needed.

---

## 4. Edge-function rate limiting

`supabase/functions/_shared/rateLimit.ts` is the shared limiter. It uses
**Upstash Redis REST** so no TCP driver is needed inside Deno.

**[OPERATOR ACTION REQUIRED]**

1. Create an Upstash Redis database (any region near your Supabase project).
2. Copy the REST URL and REST token from the Upstash dashboard.
3. Push as Supabase secrets:
   ```bash
   supabase secrets set UPSTASH_REDIS_REST_URL=https://us1-...upstash.io
   supabase secrets set UPSTASH_REDIS_REST_TOKEN=AY...
   ```

If the secrets are missing the limiter **degrades open** — requests still go
through but it logs a warning. This is intentional: losing Upstash should
never bring the API down.

Limits currently configured:

| Function | Bucket | Limit |
|---|---|---|
| `on-inspection-submit` | per-caller | 60 req / min |
| `on-inspection-submit` | global | 600 req / min |
| `supervisor-otp` | action=send | 5 req / min / caller |
| `supervisor-otp` | action=verify | 30 req / min / caller |
| `export-csv` | per-caller | 10 req / min |

Other functions (`notify-officer`, `red-alert`, `health-check`, `weekly-report`)
are not currently limited — `notify-officer` and `red-alert` are invoked only
by authenticated heads on a low-frequency path; `health-check` and
`weekly-report` are operator-only. Add limits there following the same
pattern if you ever expose them more broadly.

---

## 5. HTTP security headers

`web/vercel.json` now ships:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | denies camera / mic / geolocation / payment / usb / interest-cohort / browsing-topics |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Content-Security-Policy` | full lock-down — see file |

Static assets in `/assets/*` get `Cache-Control: public, max-age=31536000, immutable`
(safe because Vite filenames are fingerprinted).

**[OPERATOR ACTION REQUIRED]**

After the next deploy, submit the production domain to the
[HSTS preload list](https://hstspreload.org/) so browsers refuse plain-HTTP
connections even on first visit.

---

## 6. Database hardening recap

Both halves applied as of `20260513`:

| File | What it does |
|---|---|
| `supabase/migrations/20260513_backend_hardening.sql` | `sync_status` / `device_id` / `app_version` on `inspections`; `deleted_at` soft-delete on `user_roles`, `branches`, `checklist_templates`; `notifications` table + RLS; tightened `inspections.SELECT` RLS (officer-own / head-all / management-approved-only). |
| `supabase/migrations/20260513_backend_hardening_followup.sql` | Backfills `user_roles.email` from `auth.users` + adds an `auth.users` UPDATE trigger to keep them in sync; creates the `inspection-files` storage bucket with bucket-level RLS; re-asserts the realtime publication membership. |

**[OPERATOR ACTION REQUIRED]**

Apply the follow-up:

```bash
supabase db push                                # or paste into SQL Editor
```

Then uncomment any of the sanity-check queries at the bottom of the
follow-up SQL to verify the migration landed in your project.

---

## 7. Routine checks

Run on a schedule (CI cron or a manual monthly review):

1. **`/functions/v1/health-check`** — returns `200`/`207`/`503`. Hook to
   Pingdom / BetterUptime.
2. **`supabase audit log`** — review for unexpected
   `auth.signup` / `service_role` use.
3. **`git log -p -- '*.env*'`** — must show nothing tracked.
4. **`npm audit --omit=dev`** in both `web/` and `mobile/` — at least
   weekly.
