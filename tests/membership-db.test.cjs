const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

// Run the real database functions against an isolated in-memory PostgreSQL instance.
test('manual payment approval, deduplication, fixed term, renewal and reminders', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  const initial = fs.readFileSync('supabase/migrations/20261115094839_initial_broker2broker.sql', 'utf8');
  await db.exec(initial.slice(0, initial.indexOf('alter table public.users enable row level security;')).replace('create extension if not exists pgcrypto;', ''));
  await db.exec(`create role anon; create role authenticated; create role service_role;
    drop index public.payment_requests_utr_uq;
    create unique index payment_requests_utr_uq on public.payment_requests (upper(regexp_replace(upi_transaction_id, '[[:space:]]+', '', 'g')));
    create unique index payment_requests_one_open_per_user_uq on public.payment_requests(user_id) where status in ('PENDING VERIFICATION','MORE INFO REQUIRED');`);
  const rpcs = fs.readFileSync('supabase/migrations/20261115095607_supabase_backend_rpcs_and_backups.sql', 'utf8');
  await db.exec(rpcs.slice(rpcs.indexOf('create or replace function public.b2b_payment_decision('), rpcs.indexOf('create or replace function public.b2b_password_reset_complete(')));
  await db.exec(fs.readFileSync('supabase/migrations/20261126221438_fixed_monthly_membership.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261126221446_membership_reminders.sql', 'utf8'));
  await db.exec(`insert into public.users(user_id,email,password_hash,password_salt,role) values
    ('member1','one@example.test','hash','salt','USER'), ('member2','two@example.test','hash','salt','USER'), ('admin','admin@example.test','hash','salt','ADMIN');
    insert into public.settings(setting_id,key,value) values ('s1','payment.upiId','test@bank'),('s2','payment.payeeName','Test'),('s3','payment.whatsappNumber','919999999999'),('s4','payment.monthlyPrice','999'),('s5','payment.monthlyDurationDays','999');`);
  const create = (user, id, utr, amount=199) => db.query(`select public.b2b_create_payment_request($1,$2,$3,current_date,'MONTHLY',$4,'')`, [user,id,utr,amount]);
  const decide = (id, action, verified, note='', payment='payment1', subscription='sub1') => db.query('select public.b2b_payment_decision($1,$2,$3,$4,$5,$6,$7)', ['admin',id,action,note,verified,payment,subscription]);
  await assert.rejects(create('member1','bad','BADUTR1',999), /price changed/);
  await create('member1','req1','UTR0001');
  let request = (await db.query("select status,amount,duration_days from public.payment_requests where request_id='req1'")).rows[0];
  assert.equal(request.status,'PENDING VERIFICATION'); assert.equal(Number(request.amount),199); assert.equal(request.duration_days,30);
  assert.equal((await db.query("select membership_status from public.users where user_id='member1'")).rows[0].membership_status, 'FREE ACCOUNT');
  await assert.rejects(create('member1','other','UTR0002'), /awaiting review/);
  await assert.rejects(create('member2','duplicate','UTR0001'), /unique constraint/);
  await assert.rejects(decide('req1','APPROVE',false), /actual UPI credit/);
  await assert.rejects(decide('req1','REJECT',false), /reason/);
  await decide('req1','APPROVE',true);
  await assert.rejects(decide('req1','APPROVE',true), /already been reviewed/);
  const first = (await db.query("select extract(epoch from (membership_expires_at-membership_start_at)) as seconds from public.users where user_id='member1'")).rows[0];
  assert.equal(Number(first.seconds), 30*86400);
  await create('member1','req2','UTR0002');
  await decide('req2','APPROVE',true,'','payment2','sub2');
  const renewal = (await db.query("select s1.expires_at = s2.starts_at as sequential from public.subscriptions s1,public.subscriptions s2 where s1.subscription_id='sub1' and s2.subscription_id='sub2'")).rows[0];
  assert.equal(renewal.sequential,true);
  assert.equal(Number((await db.query('select count(*) as n from public.payments')).rows[0].n),2);
  await create('member2','req3','UTR0003'); await decide('req3','REJECT',false,'Not received','payment3','sub3');
  assert.equal((await db.query("select membership_status from public.users where user_id='member2'")).rows[0].membership_status, 'FREE ACCOUNT');
  await db.exec("update public.users set membership_expires_at=now()+interval '3 days' where user_id='member1'");
  assert.equal((await db.query('select public.b2b_membership_reminders() as n')).rows[0].n,1);
  assert.equal((await db.query('select public.b2b_membership_reminders() as n')).rows[0].n,0);
});
