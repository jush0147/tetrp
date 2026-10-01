import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
// Single in-flight request: no pipelining, no hidden state fed to the policy.
export function nativeClient(executable,args=[],timeoutMs=120000){
 const child=spawn(executable,args,{stdio:['pipe','pipe','pipe'],windowsHide:true});
 let pending=null,dead=null,stderr='',closing=false;
 const exited=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 function fail(error){dead=error;if(pending){clearTimeout(pending.timer);pending.reject(error);pending=null;}if(!closing)child.kill();}
 child.on('error',fail);child.stdin.on('error',fail);
 child.stderr.on('data',b=>{stderr=(stderr+b).slice(-8192);});
 child.on('close',(code,signal)=>{if(!closing||pending)fail(new Error(`native exited ${code}/${signal}: ${stderr}`));});
 const lines=createInterface({input:child.stdout});
 lines.on('line',line=>{
  if(!pending){fail(new Error('unsolicited native output'));return;}
  let result;try{result=JSON.parse(line);if(typeof result.ok!=='boolean')throw Error('invalid native envelope');if(result.ok&&!result.report)throw Error('missing report');}catch(e){fail(e);return;}
  const p=pending;pending=null;clearTimeout(p.timer);
  if(result.ok)p.resolve(result.report);else p.reject(new Error(`native request rejected: ${result.error}`));
 });
 return {
  request(text){if(dead)return Promise.reject(dead);if(closing)return Promise.reject(Error('client closed'));if(pending)return Promise.reject(Error('native request already pending'));
   if(/[\r\n]/.test(text))return Promise.reject(Error('request must be one JSON line'));
   return new Promise((resolve,reject)=>{const timer=setTimeout(()=>fail(Error('native request watchdog')),timeoutMs);pending={resolve,reject,timer};child.stdin.write(text+'\n');});},
  async close(){closing=true;if(pending)fail(Error('client closed during request'));child.stdin.end();const timer=setTimeout(()=>child.kill(),2000);await exited;clearTimeout(timer);lines.close();}
 };
}
