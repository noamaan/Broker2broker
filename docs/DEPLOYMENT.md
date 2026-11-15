# Deployment and first-run checklist

**Status (2026-11-15):** The free Supabase project **Broker2Broker** (`dfubbzyaoiwbbvkacwic`) is active and healthy in `ap-south-1` (Mumbai), in the existing organization. The initial schema, transactional backend/backup RPCs, and atomic JSON snapshot RPC are applied; private asset and backup buckets are present. No application member data has been imported. The Next.js server adapter and business-logic migration are implemented and compile checks pass, but server secrets are not configured in this workspace. No Vercel project/deployment or Git remote exists. The previously provisioned Google spreadsheet and Drive folders remain untouched and are not used by the new backend. **Do not set up or deploy Apps Script.** Do not send passwords or API keys in chat.

## 1. Configure Supabase server access

1. Open the Supabase project `Broker2Broker` (`dfubbzyaoiwbbvkacwic`) in the existing organization.
2. In the project API settings, copy a server-side secret/service-role key. The key may be the current `sb_secret_...` style or a legacy service-role key. Keep it private; it bypasses RLS and must only be used by the Next.js server.
3. The project URL is `https://dfubbzyaoiwbbvkacwic.supabase.co`. The migration history should show `initial_broker2broker`, `supabase_backend_rpcs_and_backups`, and `atomic_json_snapshot`. Do not re-run the SQL manually or create duplicate tables/buckets.
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

No GitHub repository/remote or Vercel project/deployment exists yet. The Vercel credentials were validated previously, but the deployment connector requires project settings for first deployment; do not treat an account connection as an application deployment. The GitHub connector/CLI was not available in the prior setup. From a computer authenticated to your accounts:

1. Create a private GitHub repository and push this project from your own authenticated Git installation. Do not commit `.env.local`, `.env.*` secrets, service keys, bootstrap tokens or SMTP credentials. `.gitignore` excludes local environment files and generated dependencies.
2. Import the private repository into Vercel as a Next.js app and use the detected build settings (`npm run build`).
3. Set the required environment variables above for Production and Preview as appropriate. Keep Supabase/SMTP/session/bootstrap/cron/AI values server-only.
4. Set `APP_BASE_URL` to the HTTPS deployment origin, confirm Cron support and `CRON_SECRET`, then redeploy.
5. Do not buy a domain or paid service without approval. Verify service-plan limits before launch.

GitHub Pages is not a backend host and is not suitable for this full app.

## 7. Before live launch

- Configure actual UPI/WhatsApp values and test with controlled low-value transactions; the application must not auto-verify funds.
- Test password-reset mail delivery and one-time link expiry.
- Verify RLS/table grants, private bucket access, Vercel cron authorization, manual snapshot creation and recovery steps.
- Review Terms, Privacy and Refund Policy with qualified Indian counsel and insert operating-entity/support details.
- Confirm applicable tax, consumer, privacy and data-retention obligations with advisors.
- Run the full checklist in [`TESTING.md`](TESTING.md) against a private preview deployment.
