const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const jsx=require('react/jsx-runtime');

function renderMembers(canGrant){
  const source=fs.readFileSync('components/admin-members.tsx','utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const member={userID:'USER-1',fullName:'Example Broker',email:'example@example.test',mobile:'9999999999',agencyName:'Example Agency',city:'Mira Road',role:'USER',accountStatus:'ACTIVE',membershipStatus:'PAYMENT PENDING',currentPlan:'FREE',membershipExpiresAt:'',createdAt:'2026-01-01',listingCount:1,pendingPayments:1};
  const components={useApiData:()=>({data:{items:[member],total:1,page:1,limit:50},loading:false,error:'',reload:()=>{}}),PageTitle:({title})=>React.createElement('h1',null,title),LoadingState:()=>null,AlertBox:()=>null,EmptyState:()=>null};
  const modules={'react':React,'react/jsx-runtime':jsx,'next/link':{default:({children,href,...p})=>React.createElement('a',{href,...p},children)},'@/components/dashboard-ui':components,'@/lib/client/api':{dateLabel:()=> 'date'},'lucide-react':new Proxy({}, {get:()=>()=>null})};
  const exports={};vm.runInNewContext(code,{exports,require:(n)=>{if(n in modules)return modules[n];throw Error(n)}});
  return renderToStaticMarkup(React.createElement(exports.AdminMembers,{canGrant}));
}
test('member management shows payment review to admins and grant control only to developers',()=>{
  const admin=renderMembers(false), developer=renderMembers(true);
  assert.match(admin,/Payments · 1 pending/); assert.match(admin,/\/admin\/payments\?userID=USER-1/); assert.doesNotMatch(admin,/Grant access/);
  assert.match(developer,/Grant access/);assert.match(developer,/Payments · 1 pending/);
});

test('grant endpoint checks developer role and passes validated request to backend',async()=>{
  const source=fs.readFileSync('app/api/developer/complimentary-membership/route.ts','utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  let role='',action='',payload={};
  const modules={zod:require('zod'),'@/lib/server/auth':{requireUser:async roles=>{role=roles[0];return {userID:'dev'};}},'@/lib/server/backend':{backendRequest:async(a,p)=>{action=a;payload=p;return {ok:true};}},'@/lib/server/http':{enforceSameOrigin:()=>{},readJson:async(req,schema)=>schema.parse(req.body),ok:data=>data,apiError:error=>({error:error.message})}};
  const exports={};vm.runInNewContext(code,{exports,require:n=>modules[n]});
  const result=await exports.POST({body:{userID:'member',plan:'MONTHLY',reason:'Courtesy grant',grantID:'24da7588-6233-4d9e-90de-edb3e644f850'}});
  assert.equal(role,'DEVELOPER');assert.equal(action,'developer.grantMembership');assert.equal(payload.actorID,'dev');assert.equal(result.ok,true);
  const invalid=await exports.POST({body:{userID:'member',plan:'LIFETIME',reason:'X',grantID:'wrong'}});assert.ok(invalid.error);
});
