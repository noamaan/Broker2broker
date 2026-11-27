# Testing and acceptance checklist

## Current review (2026-11-26)

- The connected Supabase project is healthy. Read-only checks show the original three migrations and RLS enabled on all 21 public tables. At the earlier review the live database contained four users and no listings or payment records; a later read-only check showed four users, no listings, two payment requests, one payment and one subscription. These are live records, not test fixtures; no live user or payment rows were changed during this review.
- The fixed-monthly and renewal-reminder migrations were applied to the connected database. Existing user, listing and payment row counts remained unchanged; real-service end-to-end testing is still outstanding.
- `npm test` exercises the actual payment SQL against an isolated in-memory PostgreSQL instance, including fixed monthly pricing, pending status, approval, duplicate references, replay, renewal, rejection and reminder deduplication. It also simulates service-worker caching. Branch tests also exercise the new SQL privacy defaults, enquiry authorization, push queue leases and worker payload handling. These are not full browser/API integration tests.
- The Vercel project has production-scoped backend/session/cron variable names, but no SMTP configuration was listed. Secret values have not been inspected or verified. The GitHub repository is public; avoid committing private information or credentials.

### Membership access controls

- Automated backend-adapter tests cover free, pending, rejected, expired, suspended and active users, including direct API actions, owner expiry, free directory contact redaction and the ability to withdraw one's own listing. SQL tests check that an enquiry cannot be sent to an expired listing owner. These are isolated/mocked checks, not live Supabase end-to-end tests.
- [ ] Verify all protected endpoints with signed-in free, pending, rejected, expired, suspended and active test accounts in an isolated Supabase-backed preview. Confirm an expired or suspended listing owner’s details and images are hidden from other users, pending payment does not unlock access, renewal restores only eligible listings, and withdrawal/deletion remains available to the owner.
- [ ] Check profile fields for possible contact-detail leakage in the free broker directory; automated redaction cannot detect every way a person may encode contact information.

### Complimentary membership review

- Automated isolated PostgreSQL tests cover developer authorization, suspended users, fixed monthly term, idempotent retries, pending requests, audit/notification, no fabricated payment and renewal with verified UPI. Component rendering tests check that administrators do not see the grant button and both roles can open member-specific payments.
- [ ] On an isolated Supabase-backed preview, authenticate as developer, admin, member and suspended member. Verify the full UI/API grant flow, server-side denials, retries after interrupted responses, reason audit, member-visible access, UPI request review and role isolation. Verify mobile layout and payment approval separately.
- [ ] Apply migrations and publish only after the above and the existing membership/PWA checklist pass. Never use real users or payment evidence for testing.

## Before inviting real members

Use a private preview deployment and test accounts for the original developer, one admin and one broker. Do not use real customer payment screenshots or credentials during testing.

### Setup and account security

- [ ] Configure `SUPABASE_URL`, server-only `SUPABASE_SERVICE_ROLE_KEY`, a separate `B2B_SESSION_SECRET`, `APP_BASE_URL`, `CRON_SECRET`, and first-run `B2B_DEVELOPER_BOOTSTRAP_TOKEN`.
- [ ] Confirm public app pages render while missing backend secrets fail closed with a configuration error; no fake member/listing/payment data appears.
- [ ] Bootstrap the original developer once. Verify the token is removed from hosting settings after use, a second bootstrap fails, normal registration cannot choose a role, and an Admin cannot enter `/developer-control`.
- [ ] Check bad password, suspended user, expired session, missing Supabase key, repeated login attempts and password reset expiry. Verify passwords remain salted/hashed, session cookies are HttpOnly/Secure in production, and security logs contain no raw IP address or password.
- [ ] Verify a member can contact an admin for a reset. After identity verification, an admin issues and privately shares a one-use, 30-minute link; only the member chooses the new password. Confirm cross-role restrictions, expiry, replay rejection, session revocation, and that no reset token or password appears in logs.
- [ ] Verify an Admin cannot grant/revoke Admin through an admin endpoint, cannot modify the original developer and cannot change developer-only settings.
- [ ] Confirm anon/authenticated roles cannot query application tables or private Storage directly; only the server key can access them.

### Membership and UPI manual review

- [ ] Register a broker. Confirm the profile is created with free-account status and private listing search is denied.
- [ ] Configure a test UPI ID/payee/WhatsApp number. Confirm fixed monthly pricing and duration (₹199/30 days); verify the existing yearly plan separately.
- [ ] Select monthly. Confirm the amount-specific QR encodes the configured UPI ID, payee and amount; confirm the optional UPI intent opens only as a payment-app handoff. A scan, intent or screenshot must never activate membership.
- [ ] Enter a test UTR/payment date and optional screenshot. Confirm exactly one `PENDING VERIFICATION` row and a matching user-visible status. Resubmitting the same UTR or creating a second pending request must fail.
- [ ] Confirm WhatsApp link uses current Admin Settings and prefilled member/payment details. The UI must say WhatsApp is not marked sent and screenshot must be attached manually.
- [ ] As Admin, verify the screenshot is linked to the request and can be fetched only by the owner/Admin. Approval without `actualCreditVerified: true` must be rejected by both UI and API.
- [ ] Approve only after independently checking actual test funds. Confirm the request, payment, subscription, user membership, notification and audit entry are committed together. Duplicate approval must fail without a second payment record.
- [ ] Confirm monthly expiry is approval/start time plus 30 days and yearly expiry is plus 365 days.
- [ ] Renew while active; confirm the new subscription starts at the previous expiry. Reject another request and confirm it grants no access or revenue.
- [ ] Test Request More Information and rejection notes. Verify pending/rejected payments do not count as collected revenue and expired/unpaid users cannot view private contact data.
- [ ] Change UPI ID, QR image and WhatsApp number; verify that the monthly price and duration cannot be changed. Reload payment page and confirm future payment details use updated values.

### Listings, search, AI and member controls

- [ ] With an active member, create a draft listing, edit it, add an image, publish it, unpublish it, mark sold/rented and delete it. Verify the image is in private Supabase Storage and only owner/active members/admin can fetch it.
- [ ] Confirm duplicate candidates warn before publish and a second explicit action is required to continue.
- [ ] Search by city/locality, transaction, property type/BHK, sale price, rent, deposit, area, furnishing and availability. Check pagination caps and that free/expired users cannot access contacts.
- [ ] Verify an active listing older than 15 days moves to Under Review through the authorized daily cron route, is hidden from search, and is submitted for administrator approval after owner reconfirmation. Confirm notification delivery and that a direct PATCH cannot bypass the reconfirm action.
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

### PWA checks (before deployment)

- [ ] On a secure preview, check the manifest and icon dimensions, then install on supported Android/desktop browsers and from Safari Share → Add to Home Screen on iOS. Check launch, navigation, sign-in and sign-out in standalone mode.
- [ ] Go offline while installed; navigations must show the offline page, never a cached account, listing, file, or payment response. Reconnect and reload.
- [ ] Deploy a worker update and confirm it takes control on a subsequent navigation. Check app behavior on mobile and safe-area devices.
- [ ] In an isolated project, apply the new public/enquiry and push migrations, configure a test VAPID pair, then verify public previews show only explicitly opted-in, approved, unexpired listings. Existing rows must stay private; images must disappear immediately when listing visibility changes. Confirm free users cannot retrieve member details, contacts or private files, and test owner/suspended/expired/pending cases.
- [ ] Send enquiries as active, free, expired, suspended and owning users; verify authorization, rate limits, notification, recipient-only and sender-only history, and pagination. Confirm the snapshot includes enquiries.
- [ ] On a secure preview and actual Android, desktop and iOS Home Screen app, grant and deny push permission, enable/disable, switch accounts on the same browser, trigger a notification, test click-through, revocation, 404/410 cleanup, retry and daily expiry reminder. Verify generic lock-screen text. Push depends on VAPID settings and cron; delivery and device support are not yet verified.
- [ ] Test the broker directory with free, active, expired and suspended accounts. Verify only active members receive contact fields from the API and suspended brokers are not listed.

Automated local checks: `npm test`, `npm run typecheck`, and `npm run build`. In-memory database tests and worker simulations do not replace real-service and real-device testing.

### Fictional property sandbox

Run `npm run dev` and open `/demo-properties` to view clearly labelled Indian and international fictional examples, with local-only filters. This route is disabled in production builds. The examples are not inserted into Supabase and cannot be used to test database search, membership, broker contact or payments. All amounts are arbitrary INR placeholders, not foreign-currency support or property valuations. Use a separate non-production Supabase project and approved test accounts for real end-to-end listing tests.

### Site navigation session state

- Automated DOM tests exercise mobile and desktop navigation with the real signed-session verifier and an isolated, mocked account backend. They cover signed-out, login, active session, logout, cross-tab notification, tampered cookie and an offline refresh. These tests do not use a real Supabase account or a real mobile device.
- [ ] In a safely configured authenticated preview, sign in with a dedicated test account and verify the public header on desktop and mobile, including after navigation, sign-out and signing in from another tab. Verify a private/logged-out window still offers login and registration. Do not share passwords or session cookies.
