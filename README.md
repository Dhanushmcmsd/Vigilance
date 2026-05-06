# Vigilance Management System

> **Architecture**: React Native (Expo) mobile app for field officers → Supabase (PostgreSQL + Storage + Realtime) → React web dashboard for heads, management & admin.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FIELD (MOBILE)                          │
│  Vigilance Officer                                          │
│  React Native (Expo) App                                    │
│  - Login                                                    │
│  - Select Branch Type (CFC / Store)                         │
│  - Select Branch                                            │
│  - Fill Checklist (offline-capable)                         │
│  - Take/upload photos                                       │
│  - Add remarks & GPS location                               │
│  - Submit                                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS / Supabase JS SDK
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (BACKEND)                        │
│  PostgreSQL DB + Auth + Storage + Realtime + Edge Functions │
│  - user_roles, branches, checklist_templates                │
│  - inspections, inspection_responses, inspection_files      │
│  - Row Level Security enforced per role                     │
│  - Realtime push on new submission                          │
│  - Edge Function: email alerts on submit                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  WEB DASHBOARD (BROWSER)                    │
│  React (Vite) + TailwindCSS + Recharts                      │
│  Vigilance Head  → Review, approve/reject, comment          │
│  Management      → Advanced analytics dashboard             │
│  Admin           → Users, checklists, branches, exports     │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
Vigilance/
├── supabase/
│   └── schema.sql          # Phase 1: Complete DB schema, RLS, seed data
├── mobile/                 # Phase 2: React Native (Expo) app
├── web/                    # Phase 3: React (Vite) dashboard
└── README.md
```

## Build Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Supabase Database Schema | ✅ Done |
| 2 | React Native Mobile App | 🔜 Next |
| 3 | React Web Dashboard | 🔜 Upcoming |

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Supabase account at [supabase.com](https://supabase.com)
- Resend.com account for email notifications

### Phase 1: Database Setup
1. Create a new Supabase project
2. Go to **SQL Editor** in your Supabase dashboard
3. Paste the contents of `supabase/schema.sql`
4. Click **Run**
5. All 8 tables, indexes, triggers, RLS policies, and seed data will be created

### Environment Variables
Create a `.env` file in `mobile/` and `web/`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
RESEND_API_KEY=your-resend-api-key
```

## Roles

| Role | Access |
|------|--------|
| `officer` | Mobile app: submit inspections for own assignments |
| `head` | Web dashboard: review, approve/reject, comment |
| `management` | Web dashboard: analytics (read-only) |
| `admin` | Full access: users, branches, checklists, exports |
