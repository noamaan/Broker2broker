const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');

// Exercise the real backend dispatch with an in-memory Supabase-shaped test adapter.
function setup(){
  const future=new Date(Date.now()+86400000).toISOString(),past=new Date(Date.now()-86400000).toISOString();
  const user=(id,status,expiry,account='ACTIVE')=>({user_id:id,role:'USER',account_status:account,membership_status:status,membership_expires_at:expiry,full_name:id,agency_name:'Sample',city:'Mira Road',mobile:'9876543210',whatsapp_number:'9876543210'});
  const rows={users:[user('free','FREE ACCOUNT',null),user('pending','FREE ACCOUNT',null),user('rejected','FREE ACCOUNT',null),user('expired','ACTIVE',past),user('suspended','ACTIVE',future,'SUSPENDED'),user('member','ACTIVE',future),user('owner','ACTIVE',future),user('expiredOwner','ACTIVE',past),user('suspendedOwner','ACTIVE',future,'SUSPENDED'),{...user('admin','FREE ACCOUNT',null),role:'ADMIN'}],
    payment_requests:[{user_id:'pending',status:'PENDING VERIFICATION',request_date:future},{user_id:'rejected',status:'REJECTED',request_date:future}],
    broker_profiles:[{user_id:'owner',bio:'Contact me on 9876543210 or broker@example.test',is_verified:true}],
    listings:[],file_assets:[],favourites:[],reports:[],audit_logs:[],notifications:[],settings:[],subscriptions:[]};
  const listing=(id,owner)=>({listing_id:id,owner_id:owner,title:'Sample listing',transaction_type:'SALE',property_type:'Flat',bhk:'2BHK',city:'Mira Road',locality:'Locality',furnishing:'NOT_SPECIFIED',status:'ACTIVE',reconfirm_due_at:future,updated_at:future,created_at:future,contact_numbers:['9876543210'],images:[`img-${id}`],is_public:true});
  rows.listings.push(listing('good','owner'),listing('bad','expiredOwner'),listing('suspendedListing','suspendedOwner'),listing('own','expired'));
  rows.file_assets=rows.listings.map(l=>({file_id:`img-${l.listing_id}`,owner_id:l.owner_id,purpose:'LISTING_IMAGE',related_id:l.listing_id,active:true,bucket:'assets',storage_path:'example',mime_type:'image/png'}));
  rows.users.find(u=>u.user_id==='owner').agency_name='Call 9876543210 broker@example.test';
  class Builder{
    constructor(table){this.table=table;this.filters=[];this.start=0;this.end=Infinity;this.isSingle=false;this.operation='select';}
    select(){return this;} eq(k,v){this.filters.push(r=>this.value(r,k)===v);return this;} neq(k,v){this.filters.push(r=>this.value(r,k)!==v);return this;} in(k,values){this.filters.push(r=>values.includes(this.value(r,k)));return this;} gt(k,v){this.filters.push(r=>this.value(r,k)>v);return this;} is(k,v){this.filters.push(r=>(this.value(r,k)??null)===v);return this;} order(){return this;} range(a,b){this.start=a;this.end=b;return this;} limit(n){this.end=n-1;return this;}
    value(r,key){if(key.startsWith('users.'))return rows.users.find(u=>u.user_id===r.owner_id)?.[key.slice(6)];return r[key];}
    maybeSingle(){this.isSingle=true;return this;} single(){this.isSingle=true;return this;} update(p){this.operation='update';this.patch=p;return this;} insert(p){this.operation='insert';this.patch=p;return this;} delete(){this.operation='delete';return this;} upsert(p){this.operation='insert';this.patch=p;return this;}
    then(resolve,reject){try{let found=(rows[this.table]||[]).filter(r=>this.filters.every(f=>f(r)));if(this.operation==='update')found.forEach(r=>Object.assign(r,this.patch));if(this.operation==='insert'){found=Array.isArray(this.patch)?this.patch:[this.patch];(rows[this.table]||=[]).push(...found);}if(this.operation==='delete')rows[this.table]=rows[this.table].filter(r=>!found.includes(r));found=found.slice(this.start,this.end+1);return Promise.resolve({data:this.isSingle?(found[0]||null):found,error:null}).then(resolve,reject);}catch(e){return Promise.reject(e).then(resolve,reject);}}
  }
  class BackendError extends Error{constructor(message,status=502,code='BACKEND_ERROR'){super(message);this.status=status;this.code=code;}}
  const backendError=(code,message)=>new BackendError(message,code==='MEMBERSHIP_REQUIRED'?403:code==='NOT_FOUND'?404:403,code);
  const client={from:table=>new Builder(table),rpc:name=>{if(name==='b2b_check_rate_limit')return Promise.resolve({data:true,error:null});throw Error(`unexpected rpc ${name}`);},storage:{from:()=>({download:async()=>({data:new Blob(['image']),error:null})})}};
  const supabase={supabaseAdmin:()=>client,dbResult:async q=>{const result=await q;if(result.error)throw result.error;return result.data;},selectAll:async table=>[...(rows[table]||[])],mapDatabaseError:e=>e};
  const modules={'server-only':{},'./push':{deliverQueuedPush:async()=>({})},'./errors':{BackendError,backendError},'./supabase':supabase,'nodemailer':{},'node:crypto':require('node:crypto')};
  const code=ts.transpileModule(fs.readFileSync('lib/server/backend.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const exports={};vm.runInNewContext(code,{exports,require:name=>modules[name]||require(name),console,Buffer,Date,URL,process,setTimeout});
  return {request:exports.backendRequest,rows};
}
const membershipError=e=>e.code==='MEMBERSHIP_REQUIRED';

test('free, pending, rejected, expired and suspended accounts cannot call member operations',async()=>{
  const {request}=setup();
  const actions=[['listings.search',{}],['listings.create',{listing:{}}],['favourites.list',{}],['favourites.add',{listingID:'good'}],['reports.create',{listingID:'good'}],['ai.context',{}],['enquiries.list',{}],['enquiries.create',{listingID:'good',message:'Please contact me about this property.'}],['files.upload',{purpose:'LISTING_IMAGE',relatedID:'own'}]];
  for(const actorID of ['free','pending','rejected','expired'])for(const [action,data] of actions)await assert.rejects(request(action,{actorID,...data}),membershipError,`${actorID}: ${action}`);
  await assert.rejects(request('listings.search',{actorID:'suspended'}),e=>e.code==='FORBIDDEN');
  await assert.rejects(request('listings.get',{actorID:'free',listingID:'good'}),membershipError);
  await assert.rejects(request('files.get',{actorID:'free',fileID:'img-good'}),e=>e.code==='FORBIDDEN');
  await assert.rejects(request('listings.update',{actorID:'expired',listingID:'own',patch:{title:'Changed details'}}),membershipError);
  await assert.rejects(request('listings.update',{actorID:'expired',listingID:'own',patch:{status:'ACTIVE'}}),membershipError);
  const requests=await request('payment.myRequests',{actorID:'pending'});assert.equal(requests[0].status,'PENDING VERIFICATION');
  const subscriptions=await request('user.mySubscriptions',{actorID:'free'});assert.equal(subscriptions.length,0);
  const own=await request('listings.my',{actorID:'expired'});assert.equal(own.length,1); // owners retain access to their own data
  const withdrawn=await request('listings.update',{actorID:'expired',listingID:'own',patch:{status:'DRAFT'}});assert.equal(withdrawn.listing.status,'DRAFT');
});

test('active members can search only live-member listings; expiry hides details and images',async()=>{
  const {request,rows}=setup();
  const search=await request('listings.search',{actorID:'member'});assert.deepEqual(Array.from(search.items,x=>x.listingID),['good']);
  assert.equal((await request('listings.get',{actorID:'member',listingID:'good'})).listingID,'good');
  await assert.rejects(request('listings.get',{actorID:'member',listingID:'bad'}),e=>e.code==='NOT_FOUND');
  await assert.rejects(request('files.get',{actorID:'member',fileID:'img-bad'}),e=>e.code==='FORBIDDEN');
  await assert.rejects(request('files.public',{listingID:'bad',fileID:'img-bad'}),e=>e.code==='NOT_FOUND');
  const preview=await request('listings.public',{});assert.deepEqual(Array.from(preview.items,x=>x.listingID),['good']);assert.equal(preview.items[0].contactNumbers,undefined);assert.equal(preview.items[0].broker,undefined);
  rows.users.find(u=>u.user_id==='owner').membership_expires_at=new Date(Date.now()-1000).toISOString();
  assert.equal((await request('listings.search',{actorID:'member'})).items.length,0);
  rows.users.find(u=>u.user_id==='owner').membership_expires_at=new Date(Date.now()+86400000).toISOString();
  assert.equal((await request('listings.search',{actorID:'member'})).items.length,1);
  rows.users.find(u=>u.user_id==='member').membership_expires_at=new Date(Date.now()-1000).toISOString();
  await assert.rejects(request('listings.search',{actorID:'member'}),membershipError);
  rows.users.find(u=>u.user_id==='member').membership_expires_at=new Date(Date.now()+86400000).toISOString();
  assert.equal((await request('listings.search',{actorID:'member'})).items.length,1);
  await assert.rejects(request('admin.listingDecision',{actorID:'admin',listingID:'bad',status:'ACTIVE'}),membershipError);
});

test('free broker directory omits bios and contact details, active members can see them',async()=>{
  const {request}=setup();
  const free=await request('brokers.directory',{actorID:'free'});const info=free.items.find(x=>x.userID==='owner');
  assert.equal(free.canContact,false);assert.equal(info.bio,'');assert.equal(info.mobile,undefined);assert.equal(info.whatsappNumber,undefined);assert.doesNotMatch(info.agencyName,/9876543210|broker@example/);
  const member=await request('brokers.directory',{actorID:'member'});const full=member.items.find(x=>x.userID==='owner');assert.equal(member.canContact,true);assert.equal(full.mobile,'9876543210');assert.match(full.bio,/9876543210/);
});
