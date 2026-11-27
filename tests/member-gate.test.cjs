const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const React=require('react');
const jsx=require('react/jsx-runtime');
const {renderToStaticMarkup}=require('react-dom/server');

test('membership gate presents upgrade link to free users and does not hide allowed staff moderation',async()=>{
  const code=ts.transpileModule(fs.readFileSync('components/member-gate.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  let current;
  const modules={'react/jsx-runtime':jsx,'next/link':{default:({children,href})=>React.createElement('a',{href},children)},'lucide-react':{LockKeyhole:()=>null},'@/lib/server/auth':{getCurrentUser:async()=>current,isMembershipActive:user=>user.membershipStatus==='ACTIVE'&&user.accountStatus==='ACTIVE'&&Date.parse(user.membershipExpiresAt)>Date.now()}};
  const exports={};vm.runInNewContext(code,{exports,require:name=>modules[name]});
  const child=React.createElement('div',null,'PRIVATE_CONTENT');
  for(const status of ['FREE ACCOUNT','PAYMENT PENDING','PAYMENT REJECTED','EXPIRED']){
    current={role:'USER',accountStatus:'ACTIVE',membershipStatus:status,membershipExpiresAt:''};
    const output=renderToStaticMarkup(await exports.MemberGate({children:child}));assert.doesNotMatch(output,/PRIVATE_CONTENT/);assert.match(output,/Active membership required/);assert.match(output,/\/dashboard\/membership/);
  }
  current={role:'USER',accountStatus:'ACTIVE',membershipStatus:'ACTIVE',membershipExpiresAt:new Date(Date.now()+60000).toISOString()};
  assert.match(renderToStaticMarkup(await exports.MemberGate({children:child})),/PRIVATE_CONTENT/);
  current={role:'ADMIN',accountStatus:'ACTIVE',membershipStatus:'FREE ACCOUNT',membershipExpiresAt:''};
  assert.match(renderToStaticMarkup(await exports.MemberGate({children:child,allowStaff:true})),/PRIVATE_CONTENT/);
  assert.doesNotMatch(renderToStaticMarkup(await exports.MemberGate({children:child})),/PRIVATE_CONTENT/);
});
