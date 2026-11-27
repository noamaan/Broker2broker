const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('pending release migrations retain existing paid account data and keep listings private', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  const schema = fs.readFileSync('supabase/migrations/20261115094839_initial_broker2broker.sql', 'utf8');
  await db.exec(schema.slice(0, schema.indexOf('alter table public.users enable row level security;')).replace('create extension if not exists pgcrypto;', ''));
  await db.exec(`create role anon; create role authenticated; create role service_role;
    insert into users(user_id,email,password_hash,password_salt,membership_status,current_plan,membership_start_at,membership_expires_at)
      values ('member','member@example.test','hash','salt','ACTIVE','YEARLY','2026-11-27 00:00:00+00','2027-11-27 00:00:00+00');
    insert into payment_requests(request_id,user_id,subscription_plan,amount,upi_transaction_id,payment_date,duration_days,status)
      values('request','member','YEARLY',1999,'TESTUTR123','2026-11-27',365,'APPROVED');
    insert into payments(payment_id,request_id,user_id,plan,amount,upi_transaction_id,payment_date,status,verified_by,verified_at)
      values('payment','request','member','YEARLY',1999,'TESTUTR123','2026-11-27','APPROVED','admin','2026-11-27 00:00:00+00');
    insert into subscriptions(subscription_id,user_id,payment_request_id,payment_id,plan,amount,duration_days,status,starts_at,expires_at,approved_by,renewal_type)
      values('subscription','member','request','payment','YEARLY',1999,365,'ACTIVE','2026-11-27 00:00:00+00','2027-11-27 00:00:00+00','admin','NEW');
    insert into listings(listing_id,owner_id,title,transaction_type,property_type,city,locality,status)
      values('listing','member','Existing listing','SALE','Flat','Mira Road','Mira Road','ACTIVE');`);
  const before = (await db.query(`select u.membership_status,u.current_plan,u.membership_expires_at,s.payment_id,s.payment_request_id,s.amount,p.status as payment_status,r.status as request_status
    from users u join subscriptions s on s.user_id=u.user_id join payments p on p.payment_id=s.payment_id join payment_requests r on r.request_id=s.payment_request_id where u.user_id='member'`)).rows[0];
  for (const file of ['20261127003430_public_listings_enquiries.sql','20261127003445_web_push.sql','20261127003507_complimentary_membership.sql','20261127003520_enquiry_owner_entitlement.sql']) {
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  const after = (await db.query(`select u.membership_status,u.current_plan,u.membership_expires_at,s.payment_id,s.payment_request_id,s.amount,p.status as payment_status,r.status as request_status
    from users u join subscriptions s on s.user_id=u.user_id join payments p on p.payment_id=s.payment_id join payment_requests r on r.request_id=s.payment_request_id where u.user_id='member'`)).rows[0];
  assert.deepEqual(after, before);
  assert.deepEqual((await db.query("select source,grant_reason from subscriptions where subscription_id='subscription'")).rows[0], { source: 'PAYMENT', grant_reason: null });
  assert.equal((await db.query("select is_public from listings where listing_id='listing'")).rows[0].is_public, false);
});
