# Deployment and first-run checklist

**Status (2026-11-26):** The connected Supabase project `dfubbzyaoiwbbvkacwic` reports ACTIVE_HEALTHY; the three original migrations are present. The fixed-monthly and reminder migrations were applied and a production deployment was promoted. Existing user, listing and payment row counts remained unchanged. Full end-to-end testing remains outstanding. Do not send passwords or API keys in chat.
**Pending branch changes:** `20261126230000_public_listings_enquiries.sql`, `20261126230100_web_push.sql`, and `20261127001000_complimentary_membership.sql` have not been applied to the connected production database. Test all three against an isolated Supabase project first. Apply them in order before deploying this branch; do not deploy code that expects these tables/columns first. The existing production release is unchanged until then. Verify migration history and take a recovery-ready backup before any production change.

## 1. Configure Supabase server access

1. Open the Supabase project `Broker2Broker` (`dfubbzyaoiwbbvkacwic`) in the existing organization.
2. In the project API settings, copy a server-side secret/service-role key. The key may be the current `sb_secret_...` style or a legacy service-role key. Keep it private; it bypasses RLS and must only be used by the Next.js server.
3. The project URL is `https://dfubbzyaoiwbbvkacwic.supabase.co`. Check migration history for `initial_broker2broker`, `supabase_backend_rpcs_and_backups`, and `atomic_json_snapshot` once the project is available. Do not re-run SQL or create duplicate tables/buckets without verifying the existing state.
4. Private buckets are `b2b-private-assets` (JPEG/PNG/WebP up to 2.6 MB) and `b2b-private-backups` (JSON snapshots up to 50 MB). Direct browser/table access is not granted; files flow through authenticated Next.js routes.

## 2. Set application environment variables

Create `.env.local` for development or set these under the hosting provider's **server-only** environment variables. Never add a `NEXT_PUBLIC_` prefix to any secret.

| Variable | Required | Purpose |
|---|---:|---|
| `SUPABASE_URL` | Yes | `https://dfubbzyaoiwbbvkacwic.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only Supabase secret/service-role key; never expose in client code. |
| `B2B_SESSION_SECRET` | Yes | Separate random value of at least 32 bytes, e.g. generate with `openssl rand -hex 32`. Do not reuse the Supabase key. |
| `B2B_DEVELOPER_BOOTSTRAP_TOKEN` | First run only | One-time random value of at least 32 characters. Remove it after developer setup succeeds. |
| `APP_BASE_URL` | Yes for reset links | Exact public HTTPS origin, no trailing slash. Use `http://localhost:3000` only for local development. |
| `CRON_SECRET` | Yes for scheduled tasks | Separate random value of at least 32 bytes. Vercel sends it as `Authorization: Bearer ...` to the daily cron route. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Needed for password reset | SMTP delivery configuration. Set credentials only on the server; port defaults to 587. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional for Web Push | Generate a unique VAPID pair with `npx web-push generate-vapid-keys`; set the public and private values in server environment variables, and set the subject to a real `mailto:` contact or HTTPS URL. Never commit the private key. Keep the pair stable; rotation requires users to re-subscribe. |
| `AI_API_KEY` | Optional | Server-only key for an OpenAI-compatible chat-completions service. |
| `AI_MODEL` | Optional | Model identifier supported by that provider. |
| `AI_BASE_URL` | Optional | HTTPS chat-completions endpoint. If omitted, the app uses the default endpoint. |

The AI provider/model selection is stored in Supabase settings. AI credentials and SMTP credentials remain in environment variables. If SMTP is not configured, password-reset requests for existing accounts return an email configuration error; configure and test mail delivery before inviting members.

For local development:

```bash
cp .env.example .env.local
# Fill in the server-only values, then restart the dev server.
npm install
npm run dev
```

## 3. Bootstrap the original developer and first admin

1. Before deploying, set a private `B2B_DEVELOPER_BOOTSTRAP_TOKEN` in the server environment. Generate it with a cryptographically secure random generator; do not commit or share it.
2. Open `/developer-control`, select first-time owner setup, and enter the token, owner name/email/mobile, and a unique password of at least 12 characters.
3. PostgreSQL atomically creates the original developer, broker profile, audit row, and canonical developer ID while consuming the one-time bootstrap state. A second bootstrap is rejected. Remove `B2B_DEVELOPER_BOOTSTRAP_TOKEN` from the environment after setup.
4. Sign in at `/developer-control`. Use Developer Control → **Users & admins** to promote the first trusted operator to Admin. Normal admins cannot create/remove admins or promote a developer.
5. In Admin → Payment settings, configure the actual UPI ID, payee name, WhatsApp number, instructions and support details. The payment page will not accept requests until required UPI/WhatsApp details are present.

## 4. Supabase/PostgreSQL behavior and data migration

The applied migrations create private application tables, indexes and server-only database functions. RLS is enabled on all app tables. The browser receives no table privileges; the server adapter uses the Supabase secret/service-role key and re-checks user role, account status, membership, ownership and developer identity for each protected operation. Account registration, first-owner bootstrap, payment approval, and password reset completion use transactional PostgreSQL functions.

The earlier Google spreadsheet is still an empty provisioned resource, and the Drive folder tree remains untouched. No historical user/listing/payment records or Drive images were copied into Supabase. If the old spreadsheet is ever populated, plan and verify a separate import before launch; do not assume a Google export was migrated.

## 5. Private snapshots and scheduled tasks

The Developer Control **Create manual snapshot** button stores a JSON snapshot in the private `b2b-private-backups` bucket and metadata in `database_backups`. Daily scheduled work is defined in `vercel.json` at `20:30 UTC` (02:00 India Standard Time): it moves due active listings to Under Review, sends notifications, and writes a private snapshot. The app keeps the 14 most recent snapshots and prunes older objects when cleanup succeeds. Set `CRON_SECRET` in the production environment; requests without the exact bearer secret are rejected. Check that the chosen hosting plan supports the configured cron schedule.

Snapshots contain private database rows (including password hashes and payment references) and must be treated as sensitive. Listing/photo/payment image bytes are not in the JSON snapshot; they remain in `b2b-private-assets`. There is no in-app restore button. For recovery, pause traffic, download the private snapshot using an authorized project-owner workflow, validate it, and restore through a controlled server-side import/SQL process; do not make either bucket public. Test the recovery procedure on a non-production project before relying on it. Also verify the current Supabase Free plan's backup/retention limits; a JSON snapshot supplements, but does not replace, provider-level recovery planning.

## 6. Private GitHub repository and Vercel deployment

The existing Vercel project `broker2broker` is linked to `noamaan/Broker2broker`, with `main` as its production branch. Preserve the existing production deployment until the full test checklist passes. Use a private preview and isolated test data; confirm the preview has correctly scoped server-only environment variables. Do not commit secrets or expose them to browser code. Verify cron support, UPI settings and SMTP before production rollout.
GitHub Pages is not a backend host and is not suitable for this full app.

## 7. Before live launch

- Configure actual UPI/WhatsApp values and test with controlled low-value transactions; the application must not auto-verify funds.
- Test password-reset mail delivery and one-time link expiry.
- Verify RLS/table grants, private bucket access, Vercel cron authorization, manual snapshot creation and recovery steps.
- Review Terms, Privacy and Refund Policy with qualified Indian counsel and insert operating-entity/support details.
- Confirm applicable tax, consumer, privacy and data-retention obligations with advisors.
- Run the full checklist in [`TESTING.md`](TESTING.md) against a private preview deployment.

## Remaining launch blockers for the requested upgrade

- Live registration, authentication, payment submission/approval, duplicate-reference handling, membership expiry and authorization must be tested against an isolated working database. The production database is healthy, but safe isolated end-to-end tests have not been completed.
- Member submissions and reconfirmations now enter pending approval in this branch; end-to-end testing, including concurrent edits and moderation, is still required before rollout.
- This branch adds opt-in anonymous previews, member-only enquiries and consent-based web push. The two new migrations and VAPID settings are not applied/configured in production. Existing listings stay private by default; opt-in owners must review photos and metadata. In-app renewal reminders were applied earlier but live cron remains untested. Push is queued and processed on enquiries or the daily cron, at most 50 jobs per invocation; delivery is best-effort, not immediate or guaranteed.
- The fixed ₹199/30-day monthly plan is implemented in the application and database; the existing configurable annual plan remains. Historical payments and memberships were not changed by the migration.
- Complete real-device install/offline tests and notification tests once implemented. Verify privacy/consent for directory visibility and phone sharing, and the accuracy of the legal pages, before inviting brokers.
- `npm audit --omit=dev` reported two moderate dependency advisories (exceljs/uuid); review compatible upgrades before rollout.

## Push rollout and operations

Set VAPID keys only in the deployment environment after isolated end-to-end testing, and verify the key pair matches. Push subscriptions belong to one account per browser and may be disabled from Notifications before sign-out; lock-screen content is generic. The database queue stores notification references but not message content. The service deletes subscriptions on 404/410, and transient delivery failures are retried with a lease, up to five attempts. The daily cron processes up to 50 jobs per run, so backlogs can take days; enquiries also trigger a best-effort batch. Monitor backlog, cron failures, and provider errors; do not claim guaranteed or real-time delivery. Push endpoints are restricted to supported browser providers. Push subscription secrets are not included in snapshots; enquiries are included. Check the secure private backup policy before migration.

## Complimentary access

The original active developer can open Admin → Manage members → Grant access. Monthly grants are 30 days; yearly grants use the configured yearly duration. The developer must supply a reason, and an atomic database function records the grant, audit entry and notification. Grants extend an active expiry; they do not create a payment, count as revenue or approve pending requests. Admins can open each member’s payments and review UPI requests normally. The function is service-role-only and independently verifies the canonical developer. Apply the complimentary migration before deploying this code. Verify grants, retries, role denial and paid renewal in an isolated environment; real-service testing is still outstanding.

A request for an isolated Supabase test branch returned a record marked as the default branch with the production project reference, not a distinct test database. Do not use or delete that record as a disposable test branch. Confirm an isolated non-production project with a separate reference before running destructive or write-based integration tests.
