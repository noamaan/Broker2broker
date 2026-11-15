# Testing and acceptance checklist

## Current migration checks

- Supabase project `dfubbzyaoiwbbvkacwic` is healthy in Mumbai. Migration history contains `initial_broker2broker` (`20261115094839`), `supabase_backend_rpcs_and_backups` (`20261115095607`), and `atomic_json_snapshot` (`20261115100836`).
- Verified RLS is enabled on all application tables, including `database_backups`; anon/authenticated roles have no table grants. Both Storage buckets are private with no browser-role object policies, and nine `b2b_*` Postgres functions are present. The snapshot RPC returned the expected 18 business-table keys and its execute ACL is limited to `postgres` and `service_role`.
- The first migration seeded 15 settings, 31 categories and 14 localities. Users, listings and payment requests are empty; no Google Sheet/Drive data was imported.
- The active Next.js backend is server-only and no longer references the Apps Script adapter. The `gas/` folder is explicitly marked legacy/do-not-deploy.
- Latest `npm run typecheck`, `npm run lint` (the same TypeScript check), and `npm run build` passed. Production smoke tests returned `200` for `/`, `/privacy`, and `/pricing`; `401` for unauthenticated `/api/auth/me` and `/api/dashboard`; and `503 BACKEND_NOT_CONFIGURED` for `/api/developer/status` when secrets are absent.
- No live account/payment/email/file workflow has been exercised through the Next.js app because the Supabase server key, session secret and SMTP configuration are not set. No Vercel project/deployment exists.

## Before inviting real members

Use a private preview deployment and test accounts for the original developer, one admin and one broker. Do not use real customer payment screenshots or credentials during testing.

### Setup and account security

- [ ] Configure `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, a separate `B2B_SESSION_SECRET`, `APP_BASE_URL`, `CRON_SECRET`, and first-run `B2B_DEVELOPER_BOOTSTRAP_TOKEN`.
- [ ] Confirm public app pages render while missing backend secrets fail closed with a configuration error; no fake member/listing/payment data appears.
- [ ] Bootstrap the original developer once. Verify the token is removed from hosting settings after use, a second bootstrap fails, normal registration cannot choose a role, and an Admin cannot enter `/developer-control`.
- [ ] Check bad password, suspended user, expired session, missing Supabase key, repeated login attempts and password reset expiry. Verify passwords remain salted/hashed, session cookies are HttpOnly/Secure in production, and security logs contain no raw IP address or password.
- [ ] Configure SMTP and test reset emails before enabling password recovery. Confirm the reset token is one-use and valid for 30 minutes only.
- [ ] Verify an Admin cannot grant/revoke Admin through an admin endpoint, cannot modify the original developer and cannot change developer-only settings.
- [ ] Confirm anon/authenticated roles cannot query application tables or private Storage directly; only the server key can access them.

### Membership and UPI manual review

- [ ] Register a broker. Confirm the profile is created with free-account status and private listing search is denied.
- [ ] Configure a test UPI ID/payee/WhatsApp number. Confirm default prices/durations (₹199/30 days and ₹1,999/365 days) or configured values.
- [ ] Select monthly. Confirm the amount-specific QR encodes the configured UPI ID, payee and amount; confirm the optional UPI intent opens only as a payment-app handoff. A scan, intent or screenshot must never activate membership.
- [ ] Enter a test UTR/payment date and optional screenshot. Confirm exactly one `PENDING VERIFICATION` row and a matching user-visible status. Resubmitting the same UTR or creating a second pending request must fail.
- [ ] Confirm WhatsApp link uses current Admin Settings and prefilled member/payment details. The UI must say WhatsApp is not marked sent and screenshot must be attached manually.
- [ ] As Admin, verify the screenshot is linked to the request and can be fetched only by the owner/Admin. Approval without `actualCreditVerified: true` must be rejected by both UI and API.
- [ ] Approve only after independently checking actual test funds. Confirm the request, payment, subscription, user membership, notification and audit entry are committed together. Duplicate approval must fail without a second payment record.
- [ ] Confirm monthly expiry is approval/start time plus 30 days and yearly expiry is plus 365 days.
- [ ] Renew while active; confirm the new subscription starts at the previous expiry. Reject another request and confirm it grants no access or revenue.
- [ ] Test Request More Information and rejection notes. Verify pending/rejected payments do not count as collected revenue and expired/unpaid users cannot view private contact data.
- [ ] Change UPI ID, price, QR image and WhatsApp number. Reload payment page and confirm future payment details use updated values.

### Listings, search, AI and member controls

- [ ] With an active member, create a draft listing, edit it, add an image, publish it, unpublish it, mark sold/rented and delete it. Verify the image is in private Supabase Storage and only owner/active members/admin can fetch it.
- [ ] Confirm duplicate candidates warn before publish and a second explicit action is required to continue.
- [ ] Search by city/locality, transaction, property type/BHK, sale price, rent, deposit, area, furnishing and availability. Check pagination caps and that free/expired users cannot access contacts.
- [ ] Verify an active listing older than 15 days moves to Under Review through the authorized daily cron route, is hidden from search, and is restored only after owner reconfirmation. Confirm notification delivery and that a direct PATCH cannot bypass the reconfirm action.
- [ ] Save/unsave a listing, share its link, contact the broker and submit a report. Confirm reports appear only in Admin review.
- [ ] Test English and Hindi/Hinglish listing conversion. With no AI provider secret, verify the rule-based fallback. If a provider is configured, confirm the key never appears in browser requests or Supabase and extracted data remains editable/unpublished until the user confirms.

### Admin, developer, exports and snapshots

- [ ] Verify suspension/reactivation, broker verification, listing/report moderation, announcements and audit logging.
- [ ] Verify Admin can manage payment settings/categories/localities but cannot change AI, maintenance or developer roles.
- [ ] Check developer analytics against approved payments only. CSV/Excel exports should contain aggregates, not password hashes or an unrestricted member dump.
- [ ] Verify Developer-only Security events show recent auth/reset signals and paginate correctly; normal Admins cannot access them.
- [ ] Enable/disable maintenance mode; ordinary members are blocked while Developer/Admin operations continue.
- [ ] Run Developer health check. Confirm PostgreSQL tables, both private buckets, developer status and configured scheduled tasks.
- [ ] Create a manual snapshot. Confirm a dated JSON object appears in private `b2b-private-backups`, metadata is recorded, and the backup bucket cannot be read anonymously. Verify images are not embedded.
- [ ] Send a test request with an invalid/missing cron bearer secret and confirm `401`; authorized daily cron should run reconfirmation and snapshot work.
- [ ] Test restoring a snapshot only in a non-production Supabase project using an authorized owner-controlled process.

### Responsive and deployment checks

- [ ] Check registration, member workspace, payment page, listing forms, admin review and developer console on mobile, tablet and desktop.
- [ ] Confirm all navigation/action buttons call real API routes; no fake payment success or public database/Storage URLs are present.
- [ ] Review Vercel and Supabase logs for errors. Keep secrets out of Git history and confirm the GitHub repository is private.
