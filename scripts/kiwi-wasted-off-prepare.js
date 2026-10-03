// Production delta: wasted_t only in review_h9_h12. Tests are cfg(test) only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export function transform(source){
 const before='        config.freestyle_weights.softdrop = 0.0;';
 const after=before+'\n        if cfg!(wasted_off) { config.freestyle_weights.wasted_t = 0.0; }';
 assert.equal(source.split(before).length,2,'Expected exactly one accepted profile anchor');
 return source.replace(before,after);
}
if(process.argv[2]==='install'){
 const root=process.argv[3]??'.cache/cc2-wasm-source',out='.cache/wasted-build';await mkdir(out,{recursive:true});
 const path=`${root}/src/bot.rs`,before=await readFile(path,'utf8'),after=transform(before);
 await writeFile(path,after);
 const f=`${root}/src/bot/freestyle.rs`;
 await writeFile(f,(await readFile(f,'utf8'))+'\n'+await readFile('tools/cc2-eval-audit/wasted_off_tests.rs','utf8'));
 const sha=s=>createHash('sha256').update(s).digest('hex');
 await writeFile(`${out}/source-delta.json`,JSON.stringify({onlyProductionChange:'review_h9_h12.wasted_t: -1.5 -> 0 via wasted_off cfg',before:sha(before),after:sha(after),visibleT:false},null,2));
}
