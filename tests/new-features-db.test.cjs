const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const ts = require('typescript');
const vm = require('node:vm');

test('listing partial updates do not reset omitted fields', () => {
  const code = ts.transpileModule(fs.readFileSync('lib/server/schemas.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const exports = {}; vm.runInNewContext(code, {exports, require});
  assert.deepEqual(JSON.parse(JSON.stringify(exports.listingPatchSchema.parse({status:'ACTIVE'}))), {status:'ACTIVE'});
  assert.deepEqual(JSON.parse(JSON.stringify(exports.listingPatchSchema.parse({images:['file1']}))), {images:['file1']});
});

test('public opt-in, enquiries and push queue use isolated transactional database', async t => {
  const db=await PGlite.create(); t.after(()=>db.close());
  const initial=fs.readFileSync('supabase/migrations/20261115094839_initial_broker2broker.sql','utf8');
  await db.exec(initial.slice(0,initial.indexOf('alter table public.users enable row level security;')).replace('create extension if not exists pgcrypto;',''));
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(`insert into public.users(user_id,email,password_hash,password_salt,role,membership_status,membership_expires_at) values
    ('owner','owner@example.test','hash','salt','USER','ACTIVE',now()+interval '30 days'),
    ('member','member@example.test','hash','salt','USER','ACTIVE',now()+interval '30 days'),
    ('free','free@example.test','hash','salt','USER','FREE ACCOUNT',null),
    ('expired','expired@example.test','hash','salt','USER','ACTIVE',now()-interval '1 day');
    insert into public.listings(listing_id,owner_id,title,transaction_type,property_type,city,locality,status,reconfirm_due_at) values
    ('private','owner','Private apartment','SALE','Apartment','Mira Road','Mira Road','ACTIVE',now()+interval '1 day'),
    ('pending','owner','Pending apartment','SALE','Apartment','Mira Road','Mira Road','PENDING_APPROVAL',now()+interval '1 day');`);
  await db.exec(fs.readFileSync('supabase/migrations/20261126230000_public_listings_enquiries.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261126230100_web_push.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261127002000_enquiry_owner_entitlement.sql','utf8'));
  assert.equal((await db.query("select is_public from listings where listing_id='private'")).rows[0].is_public,false);
  await db.exec("insert into push_subscriptions(subscription_id,user_id,endpoint,p256dh,auth_key) values('sub','owner','https://fcm.googleapis.com/example','key','auth')");
  const send=(actor,listing,message='Please contact me about this listing.')=>db.query('select b2b_create_enquiry($1,$2,$3) as id',[actor,listing,message]);
  await assert.rejects(send('free','private'),/MEMBERSHIP_REQUIRED/);await assert.rejects(send('expired','private'),/MEMBERSHIP_REQUIRED/);
  await assert.rejects(send('owner','private'),/own listing/);await assert.rejects(send('member','pending'),/not currently available/);await assert.rejects(send('member','private','short'),/10 and 1000/);
  const id=(await send('member','private')).rows[0].id;
  assert.equal((await db.query('select sender_id,recipient_id,message from enquiries where enquiry_id=$1',[id])).rows[0].recipient_id,'owner');
  assert.equal(Number((await db.query('select count(*) n from notifications')).rows[0].n),1);
  assert.equal(Number((await db.query('select count(*) n from push_queue')).rows[0].n),1);
  const claim=await db.query('select * from b2b_claim_push(50)');assert.equal(claim.rows.length,1);assert.equal(claim.rows[0].attempts,1);
  assert.equal((await db.query('select * from b2b_claim_push(50)')).rows.length,0);
  await db.exec("update users set membership_expires_at=now()-interval '1 second' where user_id='owner'");
  await assert.rejects(send('member','private'),/not currently available/);
  await db.exec("update users set membership_expires_at=now()+interval '1 day' where user_id='owner'");
  assert.equal((await db.query("select has_table_privilege('anon','public.enquiries','select') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.b2b_claim_push(integer)','execute') as allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select jsonb_array_length(b2b_export_snapshot()->'enquiries') as n")).rows[0].n,1);
  await db.exec("delete from push_subscriptions where subscription_id='sub'");
  assert.equal(Number((await db.query('select count(*) n from push_queue')).rows[0].n),0);
});

test('push endpoint allowlist rejects non-provider hosts, credentials and non-HTTPS URLs', () => {
  const code=ts.transpileModule(fs.readFileSync('lib/server/push.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={}; vm.runInNewContext(code,{exports,require:(name)=>name==='server-only'?{}:name==='web-push'?{}:name==='./supabase'?{}:require(name),URL,process});
  const valid=exports.validPushEndpoint;
  assert.equal(valid('https://fcm.googleapis.com/fcm/send/abc'),true);
  assert.equal(valid('https://updates.push.services.mozilla.com/wpush/v2/abc'),true);
  assert.equal(valid('https://web.push.apple.com/Q/abc'),true);
  for(const endpoint of ['http://fcm.googleapis.com/a','https://fcm.googleapis.com.evil.test/a','https://evil.test/a','https://fcm.googleapis.com@evil.test/a','https://fcm.googleapis.com:8443/a','http://127.0.0.1/']) assert.equal(valid(endpoint),false,endpoint);
});
