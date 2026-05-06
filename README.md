# Vigilance Management System

A full-stack inspection compliance platform for supermarkets across Kerala, India.

```
┌──────────────────────────────────────────────────────┐
│         ARCHITECTURE OVERVIEW                    │
└──────────────────────────────────────────────────────┘

  [Officer Mobile App]        [Web Dashboard]
  React Native + Expo         React 18 + Vite
        |                           |
        └─────────┬─────────────┘
                   |
        ┌────────┴─────────┐
        │       SUPABASE          │
        │  Auth + PostgreSQL      │
        │  Storage + Realtime     │
        │  Edge Functions         │
        └───────────────────┘
                   |
        ┌────────┴─────────┐
        │       RESEND            │
        │  Email Alerts +         │
        │  Weekly Reports         │
        └───────────────────┘

Deployments:
  Mobile  → Expo EAS (iOS + Android)
  Web     → Vercel
```

---

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli eas-cli`
- Supabase account (free tier)
- Resend account (free tier)
- Vercel account (free tier)

---

## Mobile App Setup

```bash
cd mobile
npm install
```

1. Copy `.env.example` to `.env.local`
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Start development:
   ```bash
   npx expo start
   ```

---

## Web Dashboard Setup

```bash
cd web
npm install
```

1. Copy `.env.production` and fill in values:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
2. Start development:
   ```bash
   npm run dev
   ```

---

## Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. In SQL Editor, run the schema file: `supabase/schema.sql`
3. Run the edge function setup SQL: `supabase/edge-functions-setup.sql`
   - Replace `YOUR_PROJECT_REF` with your actual Supabase project reference ID
4. Enable Realtime for the `inspections` table:
   - Database > Replication > Enable for `inspections`
5. Create storage bucket:
   - Storage > New bucket: `inspection-files` (public)

---

## Edge Functions Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
supabase secrets set RESEND_API_KEY=your_resend_key
supabase secrets set DASHBOARD_URL=https://your-vercel-domain.vercel.app

# Deploy both functions
supabase functions deploy on-inspection-submit
supabase functions deploy weekly-report
```

---

## Deployment

### Mobile (Expo EAS)

```bash
cd mobile

# Configure EAS project
eas init

# Build Android APK (preview)
eas build --platform android --profile preview

# Build iOS (preview)
eas build --platform ios --profile preview

# Production builds
eas build --platform android --profile production
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

### Web (Vercel)

```bash
cd web

# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Add Environment Variables in Vercel Project Settings:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Custom Domain:**
1. In Vercel dashboard → Project → Settings → Domains
2. Add your domain
3. Update DNS at your registrar with the CNAME provided by Vercel
4. Vercel automatically provisions SSL via Let's Encrypt

---

## Supabase Production Checklist

- [ ] Enable email auth with custom SMTP (Authentication > Settings > SMTP)
- [ ] Set JWT expiry to 3600s (1 hour) for security
- [ ] Enable Realtime for `inspections` table (Database > Replication)
- [ ] Create `inspection-files` storage bucket with public read policy
- [ ] Enable automated daily backups (Database > Backups)
- [ ] Set Edge Function secrets: `RESEND_API_KEY`, `DASHBOARD_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Enable pg_cron extension for weekly report scheduler
- [ ] Enable pg_net extension for database webhooks
- [ ] Set Row Level Security policies on all tables
- [ ] Rate limit: configure under Authentication > Rate Limits (default 4 req/min for email is fine)
- [ ] Disable public sign-ups (admin creates users only)

---

## User Guide

### Officer (Mobile App)
1. Login with credentials provided by admin
2. Tap **Start Inspection** on the home screen
3. Select the branch to inspect
4. Fill in the checklist — Yes / No / N/A for each item, add remarks as needed
5. Attach photos with the camera icon
6. Tap **Submit** when done
7. View past submissions under **My Submissions**
8. The app works offline — submissions auto-sync when internet is restored

### Vigilance Head (Web Dashboard)
1. Login at your Vercel URL
2. The **Dashboard** shows pending inspections sorted by risk level
3. Click **Review Now** or navigate to **Review Inspections**
4. Select an inspection on the left panel
5. Review checklist responses, photos, and officer remarks
6. Add a **Head Comment** (required), then click Approve / Reject / Request Clarification
7. Keyboard shortcuts: `A` = Approve, `R` = Reject, `↑↓` = navigate inspections

### Management (Web Dashboard)
1. Login at your Vercel URL
2. The **Management Dashboard** shows KPI cards, compliance trend charts, and branch rankings
3. Use the date range filter at the top to change the period
4. Click any branch row to open the Branch Detail Drawer
5. Use **Export CSV** or **Print Report** for offline analysis

### Admin (Web Dashboard)
1. Navigate to **Admin Panel**
2. **Users tab**: Create, edit, deactivate users; reset passwords
3. **Checklists tab**: Add/edit/reorder checklist items by type
4. **Branches tab**: Add/edit/deactivate branches; view on map
5. **Reports tab**: Export inspection data as CSV; view system statistics

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Login fails | Check Supabase URL and anon key in `.env` |
| Role not found | Ensure user has a row in `user_roles` table |
| Realtime not working | Enable Realtime for `inspections` in Supabase Dashboard |
| Photos not uploading | Check `inspection-files` bucket exists and is public |
| Edge function 500 error | Check `supabase functions logs on-inspection-submit` |
| Weekly email not sending | Verify pg_cron is enabled and `RESEND_API_KEY` secret is set |
| Offline sync stuck | Check AsyncStorage permissions; restart app |
| Vercel deploy fails | Ensure env vars are set in Vercel Project Settings |
