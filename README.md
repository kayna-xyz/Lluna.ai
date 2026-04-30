Lluna AI (MedSpa Assistant)

A monorepo Next.js application with a consumer-facing questionnaire/report flow and a clinic-side dashboard. APIs are implemented under app/api, with data powered by Supabase.

Requirements
Node.js 18+ (recommended: 20 LTS)
Package manager: pnpm (lockfile included), or npm / yarn
1. Install Dependencies

From the project root:

cd Lluna-AI-V1-main
pnpm install

If pnpm is not installed:

npm install -g pnpm

Or use:

npm install
2. Environment Variables
Copy the example file:
cp .env.example .env.local
Edit .env.local and add the following from Supabase
(Settings → API):
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (server-only, do NOT commit)
Database setup
Run migrations in Supabase SQL Editor following:
SUPABASE_SETUP.md
supabase/MIGRATION_RUNBOOK.md

Make sure to include migrations 002 and 007 (multi-tenant support). Missing 002 may cause schema mismatches.

Validation & seeding (optional)
pnpm check-env
pnpm seed-menu

To seed a specific clinic:

CLINIC_SLUG=your-slug pnpm seed-menu
Optional integrations
ANTHROPIC_API_KEY — enables AI features (recommendations, summaries, menu parsing). Without it, fallback logic is used.
Resend (email): see .env.example
3. Run Development Server

From the project root (do not start from subfolders like app/clinicside):

pnpm dev

App runs at:
http://localhost:3000

4. Smoke Test

In a new terminal:

pnpm smoke

Default target:

http://127.0.0.1:3000

For deployed environments:

BASE_URL=https://your-domain pnpm smoke
5. Consumer vs Clinic Views
Role	Description	URL
Consumer	Questionnaire & report flow	/?clinic=slug
Clinic Dashboard	Clients, reports, campaigns	/clinicside/app?clinic=slug

Example:

http://localhost:3000/?clinic=default
http://localhost:3000/clinicside

/clinicside automatically redirects to /clinicside/app.

6. Production Build
pnpm build
pnpm start

Ensure environment variables and database migrations are properly configured in production.

7. Troubleshooting
/api/clients returns configured: false
→ Missing or misconfigured Supabase env variables. Restart dev server.
Database errors (missing columns / conflicts)
→ Migration 002_pending_reports_align.sql not applied.
Clinic dashboard UI issues
→ Always run from root with pnpm dev.
The app/clinicside folder contains legacy structure and does not need separate setup.
