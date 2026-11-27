const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const jsx=require('react/jsx-runtime');

test('demo page is only available in development, not production',()=>{
  const code=ts.transpileModule(fs.readFileSync('app/demo-properties/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  for(const mode of ['development','production']){
    const exports={};const modules={'react/jsx-runtime':jsx,'next/navigation':{notFound:()=>{throw new Error('NOT_FOUND');}},'@/components/demo-properties':{DemoProperties:()=>null}};
    vm.runInNewContext(code,{exports,process:{env:{NODE_ENV:mode}},require:name=>modules[name]});
    if(mode==='production')assert.throws(()=>exports.default(),/NOT_FOUND/);else assert.ok(exports.default());
  }
});
