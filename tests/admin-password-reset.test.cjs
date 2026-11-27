const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

test('admin reset links are restricted, one-use, expire, audit, and invalidate only target sessions', async t => {
  const db = await PGlite.create(); t.after(() => db.close());
  const schema = fs.readFileSync('supabase/migrations/20261115094839_initial_broker2broker.sql','utf8');
  await db.exec(schema.slice(0,schema.indexOf('alter table public.users enable row level security;')).replace('create extension if not exists pgcrypto;',''));
  await db.exec(`create role anon; create role authenticated; create role service_role;
    insert into users(user_id,email,password_hash,password_salt,role,account_status,membership_status,current_plan,membership_expires_at) values
    ('member','member@test.invalid','oldhash','oldsalt','USER','ACTIVE','ACTIVE','MONTHLY','2030-01-01'),
    ('member2','member2@test.invalid','oldhash','oldsalt','USER','ACTIVE','FREE ACCOUNT','FREE',null),
    ('suspended','suspended@test.invalid','oldhash','oldsalt','USER','SUSPENDED','FREE ACCOUNT','FREE',null),
    ('admin','admin@test.invalid','oldhash','oldsalt','ADMIN','ACTIVE','ACTIVE','MONTHLY',null),
    ('admin2','admin2@test.invalid','oldhash','oldsalt','ADMIN','ACTIVE','ACTIVE','MONTHLY',null),
    ('developer','developer@test.invalid','oldhash','oldsalt','DEVELOPER','ACTIVE','ACTIVE','MONTHLY',null);
    update platform_config set value='developer' where key='developer_user_id';
    insert into developers(developer_id,user_id,status,email) values('dev','developer','ACTIVE','developer@test.invalid');`);
  await db.exec(fs.readFileSync('supabase/migrations/20261127004225_admin_password_reset.sql','utf8'));
  const h = 'a'.repeat(64), h2 = 'b'.repeat(64);
  const issue = (actor, target, hash = h) => db.query('select b2b_admin_issue_password_reset($1,$2,$3)', [actor,target,hash]);
  for (const [actor,target] of [['member','member2'],['admin','admin2'],['admin','developer'],['admin','suspended'],['developer','developer']])
    await assert.rejects(issue(actor,target), /FORBIDDEN/);
  await assert.rejects(issue('admin','member','bad'), /INVALID_INPUT/);
  const priv = (await db.query("select has_function_privilege('anon','public.b2b_admin_issue_password_reset(text,text,text)','execute') a, has_function_privilege('authenticated','public.b2b_password_reset_complete(text,text,text)','execute') b, has_function_privilege('service_role','public.b2b_admin_issue_password_reset(text,text,text)','execute') c")).rows[0];
  assert.deepEqual(priv,{a:false,b:false,c:true});
  await issue('admin','member'); await issue('admin','member',h2);
  await assert.rejects(db.query('select b2b_password_reset_complete($1,$2,$3)',[h,'newhash','newsalt']), /INVALID_TOKEN/);
  await db.query('select b2b_password_reset_complete($1,$2,$3)',[h2,'newhash','newsalt']);
  await assert.rejects(db.query('select b2b_password_reset_complete($1,$2,$3)',[h2,'newhash','newsalt']), /INVALID_TOKEN/);
  let row = (await db.query("select password_hash,password_salt,password_reset_hash,session_version,membership_status,current_plan from users where user_id='member'")).rows[0];
  assert.deepEqual(row,{password_hash:'newhash',password_salt:'newsalt',password_reset_hash:null,session_version:1,membership_status:'ACTIVE',current_plan:'MONTHLY'});
  assert.equal((await db.query("select session_version from users where user_id='member2'")).rows[0].session_version,0);
  assert.equal((await db.query("select count(*)::int n from audit_logs where action='ADMIN_PASSWORD_RESET_LINK_ISSUED' and actor_id='admin' and entity_id='member'")).rows[0].n,2);
  await issue('developer','admin2');
  await db.query("update users set password_reset_expires_at=now()-interval '1 second' where user_id='admin2'");
  await assert.rejects(db.query('select b2b_password_reset_complete($1,$2,$3)',[h,'newhash','newsalt']), /INVALID_TOKEN/);
});

test('existing cookies work until a reset, then old cookies are rejected and new ones work', async () => {
  let cookie = ''; const jar = { get: () => ({value:cookie}), set: (_k,v) => {cookie=v;} };
  const user = {userID:'member',accountStatus:'ACTIVE',role:'USER',sessionVersion:0};
  const code = ts.transpileModule(fs.readFileSync('lib/server/auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {}; const old = process.env.B2B_SESSION_SECRET; process.env.B2B_SESSION_SECRET='a-test-secret-that-is-long-enough-1234567890';
  try {
    vm.runInNewContext(code,{exports,require:n=>({'server-only':{},'next/headers':{cookies:async()=>jar},'./backend':{backendRequest:async()=>user}}[n]??require(n)),process,Buffer,Date,console});
    await exports.setSessionCookie('member'); assert.equal((await exports.requireUser()).userID,'member');
    user.sessionVersion=1; assert.equal(await exports.getCurrentUser(),null); await assert.rejects(exports.requireUser(), e=>e.code==='SESSION_INVALID');
    await exports.setSessionCookie('member',1); assert.equal((await exports.requireUser()).userID,'member');
    const oldRaceToken=exports.createSessionToken('member',0); cookie=oldRaceToken; assert.equal(await exports.getCurrentUser(),null);
  } finally {if(old===undefined) delete process.env.B2B_SESSION_SECRET; else process.env.B2B_SESSION_SECRET=old;}
});

test('reset endpoint only permits signed-in staff and returns a private link after a successful backend check', async () => {
  const modules = {
    '@/lib/server/auth': { requireUser: async roles => { assert.deepEqual(Array.from(roles),['ADMIN','DEVELOPER']); return {userID:'admin'}; } },
    '@/lib/server/password': { randomResetToken: ()=>'x'.repeat(43) },
    '@/lib/server/backend': { backendRequest: async (action,data) => { assert.equal(action,'admin.issuePasswordReset');assert.equal(data.actorID,'admin');assert.equal(data.userID,'member');assert.equal(data.token,'x'.repeat(43)); } },
    '@/lib/server/http': { enforceSameOrigin:()=>{}, readJson:async()=>({userID:'member'}), ok:data=>Response.json(data,{headers:{'Cache-Control':'no-store'}}), apiError:()=>new Response('',{status:403}) },
    '@/lib/server/schemas': {adminPasswordResetSchema:{}}
  };
  const code=ts.transpileModule(fs.readFileSync('app/api/admin/password-reset/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={}; const old=process.env.APP_BASE_URL; process.env.APP_BASE_URL='https://example.test';
  try { vm.runInNewContext(code,{exports,require:n=>modules[n]??require(n),process,Response,URL,encodeURIComponent});
    const result=await exports.POST(new Request('https://example.test/api/admin/password-reset',{method:'POST'}));
    assert.equal(result.headers.get('cache-control'),'no-store'); assert.equal((await result.json()).resetUrl,`https://example.test/reset-password?token=${'x'.repeat(43)}`);
  } finally {if(old===undefined)delete process.env.APP_BASE_URL;else process.env.APP_BASE_URL=old;}
});
