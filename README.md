# Broker2Broker

**One Network. Every Property Opportunity.**

A Next.js and TypeScript real-estate broker network backed by Supabase PostgreSQL and private Supabase Storage. Membership activation remains a manual UPI-review workflow; this app does not verify money transfers automatically.

Developer credit: **Developed by Noamaan Shaikh**. This attribution is source-controlled and is not an administrator setting.

## What is implemented

- Public home, About, Pricing, How it works, Contact, Terms, Privacy and Refund Policy pages.
- Free broker registration with server-side password hashing, signed HttpOnly sessions, login, password reset and password change.
- A server-only Supabase adapter and PostgreSQL migration schema for members, broker profiles, listings, payments, subscriptions, categories, localities, reports, notifications, settings, security/audit logs and private file metadata.
- Member workspace: membership status, manual UPI payment request, dynamic amount-specific UPI QR, WhatsApp deep link, protected listing search, listing composer/management, AI-assisted WhatsApp text conversion with a rule-based fallback, saved properties, reports, profile and notifications.
- Admin workspace: manually review UPI requests, require an explicit actual-credit confirmation before approval, manage members, moderate listings/reports, send in-app announcements, edit payment/WhatsApp settings and manage categories/localities.
- Developer-only `/developer-control`: one-time owner bootstrap, administrator roles, financial analytics/exports, private security-event review, AI/platform configuration, maintenance mode, health checks and private database snapshots.
- Private Supabase Storage for listing images, payment evidence, and QR artwork. The Next.js server checks the session, owner, membership, listing, or staff permissions before serving an asset.
- A Vercel Cron route for daily listing reconfirmation and JSON database snapshots.

## Supabase provisioning status

The free Supabase project **Broker2Broker** (`dfubbzyaoiwbbvkacwic`) is active in `ap-south-1` (Mumbai), in the existing organization. Its initial schema, transactional backend RPCs, private backup storage and consistent JSON snapshot RPC are applied. They create private tables with RLS, server-only functions for atomic account/payment operations, and private asset/backup buckets. The project starts with no member accounts or listings; only the default settings, categories and localities are seeded.

The Next.js source is not yet connected to production environment secrets, and no Vercel project/deployment or Git remote exists. Google Sheets and Drive resources provisioned earlier remain untouched and are **not used by the application**. No Apps Script project has been set up or deployed; do not deploy the legacy reference under `gas/`.

## Quick start

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local
# Set the server-only Supabase key and a separate session secret in .env.local.
npm run dev
```

Required local server variables:

- `SUPABASE_URL` — the Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY` — a server-only Supabase secret/service-role key. Never prefix it with `NEXT_PUBLIC_` or expose it to browser code.
- `B2B_SESSION_SECRET` — a separate random secret of at least 32 bytes.

Set `B2B_DEVELOPER_BOOTSTRAP_TOKEN` to a private random value of at least 32 characters to enable first-owner setup. The value is consumed once by the database after successful bootstrap; remove it from the hosting environment afterwards. `CRON_SECRET` enables the scheduled task endpoint. Set SMTP variables to enable password-reset email delivery. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for exact setup steps.

The public marketing pages render without secrets. Member data APIs fail closed until Supabase and session secrets are configured; the app never fills missing backends with fake data.

Run checks:

```bash
npm run typecheck
npm run build
```

## Manual payment rules

- Default plans: **₹199 / 30 days** and **₹1,999 / 365 days**. Authorized staff can change them in Admin → Payment settings.
- The customer enters the UPI transaction reference and payment date; a screenshot is optional evidence.
- The request is saved as `PENDING VERIFICATION`.
- An authorized admin must independently verify the actual UPI credit and then approve. A QR scan, payment intent, WhatsApp message or screenshot does not prove that funds arrived.
- Approval, payment, subscription, user membership, notification and audit writes are performed together in a database transaction.
- Approved renewals begin at the current expiry date if the membership is still active. Pending/rejected payments are not counted as revenue.

## Security and privacy notes

- All application tables have RLS enabled; browser roles receive no table access. Only the server holds the Supabase secret/service-role key.
- Application roles and membership status are re-checked against PostgreSQL on protected operations. The custom session cookie is signed, HttpOnly and Secure in production.
- Listing contact numbers are returned only to active members, the listing owner or authorized staff. Server-side rate limits use Supabase/PostgreSQL.
- Listing images, payment screenshots and database snapshots are private Storage objects. Snapshots contain private database records (including password hashes) and must be treated as sensitive credentials; image contents are not included in the JSON snapshot.
- Do not store Supabase secrets, session secrets, SMTP passwords, AI credentials or bootstrap tokens in browser settings, public source, or a Git repository.
- Visual listing watermarks are deterrents only. Screenshots and manual copying cannot be completely prevented.
- AI provider credentials are server-only. If an AI-compatible provider is configured, submitted message text is sent to that provider. Review the privacy policy and provider terms before enabling it.

## Project structure

```text
app/                    Next.js pages, API routes and protected cron route
components/             Responsive public, member, admin and developer UI
lib/server/              Supabase adapter, server business logic, sessions and validation
lib/client/              Browser request helpers
supabase/migrations/     Applied PostgreSQL schema and RPC migrations
gas/                     Legacy reference only; not part of runtime and must not be deployed
docs/                    Deployment and testing guides
```
