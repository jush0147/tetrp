import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeClient} from '../scripts/kiwi-native-client.js';
test('persistent native protocol retains reports and recovers after explicit rejection',async()=>{
 const c=nativeClient(process.execPath,['-e',`require('readline').createInterface({input:process.stdin}).on('line',s=>{const x=JSON.parse(s);console.log(JSON.stringify(x.reject?{ok:false,error:'fixture'}:{ok:true,report:x}));});`]);
 try{await assert.rejects(c.request('{\n}'),/one JSON line/);assert.deepEqual(await c.request('{"nodes":200000,"spin":"full"}'),{nodes:200000,spin:'full'});await assert.rejects(c.request('{"reject":true}'),/fixture/);assert.deepEqual(await c.request('{"nodes":5}'),{nodes:5});}finally{await c.close();}
});
test('malformed output and process exit are technical failures',async()=>{
 for(const source of [`process.stdin.once('data',()=>console.log('oops'))`,`process.stdin.once('data',()=>process.exit(7))`]){
  const c=nativeClient(process.execPath,['-e',source]);try{await assert.rejects(c.request('{}'));}finally{await c.close();}
 }
});
test('concurrent calls are rejected and a stalled request fails the watchdog',async()=>{
 const c=nativeClient(process.execPath,['-e',`process.stdin.resume();`],200);
 try{const pending=c.request('{}');const check=assert.rejects(pending,/watchdog/);await assert.rejects(c.request('{}'),/already pending/);await check;}finally{await c.close();}
});
