# Vigilance Management System (VMS)

A professional-grade compliance and inspection platform designed for retail chains and supermarkets. VMS provides a complete end-to-end solution for field audits, real-time risk monitoring, and executive analytics.

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Framer Motion |
| **Mobile** | React Native, Expo, Leaflet (Geofencing) |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions, Realtime) |
| **Database** | PostgreSQL with PostGIS for geospatial queries |
| **Infrastructure** | Vercel (Web), Expo EAS (Mobile) |
| **Integrations** | Resend (Email), Upstash (Rate Limiting) |

## Key Features

- **Role-Based Access Control (RBAC):** Dedicated dashboards and permissions for Field Officers, Vigilance Heads, Management (CEO), and Admins.
- **Geofenced Inspections:** Mobile app enforces store presence via GPS geofencing (PostGIS) before allowing audit submissions.
- **Real-time Risk Alerts:** Immediate escalation of "Critical" and "High" risk findings via email alerts to management.
- **Executive Analytics:** High-level KPI cards, compliance trend charts, and branch rankings for data-driven decision making.
- **Automated Reporting:** Weekly compliance summaries and monthly archives generated automatically via scheduled tasks.
- **Offline-First Mobile:** Field officers can perform audits in low-connectivity areas; data auto-syncs when back online.
- **Audit Reports Hub:** Dedicated portal for downloading historical PDF audit reports and exporting raw data as CSV.
- **Checklist Management:** Dynamic checklist templates that can be updated by admins without code changes.

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI (for backend changes)
- Expo CLI (for mobile development)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Vigilance
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   *Note: The root `postinstall` script will automatically install dependencies for both `web/` and `mobile/`.*

3. **Environment Setup:**
   - Web: Copy `web/.env.example` to `web/.env` and fill in Supabase credentials.
   - Mobile: Copy `mobile/.env.example` to `mobile/.env` and fill in Supabase credentials.

4. **Run Development Servers:**
   - Web: `npm run dev:web`
   - Mobile: `npm run dev:mobile`

---

## Deployment

### Web Dashboard
The web dashboard is optimized for deployment on **Vercel**. Simply link the repository and configure the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

### Mobile App
The mobile app uses **Expo EAS** for builds and submissions.
```bash
cd mobile
eas build --platform android --profile production
```

### Backend (Supabase)
Deploy edge functions and database migrations using the Supabase CLI:
```bash
supabase link --project-ref your-project-id
supabase db push
supabase functions deploy
```

---

## License
This project is proprietary software. All rights reserved.
