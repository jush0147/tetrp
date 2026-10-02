// Production delta: one coefficient in review_h9_h12. Tests are cfg(test) only.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export function transform(source){
 const before='        config.freestyle_weights.h9_cavity_excavation = -0.5;';
 const after='        config.freestyle_weights.h9_cavity_excavation = if cfg!(h9_off) { 0.0 } else { -0.5 };';
 assert.equal(source.split(before).length,2,'Expected exactly one accepted H9 assignment');
 return source.replace(before,after);
}
if(process.argv[2]==='install'){
 const root=process.argv[3]??'.cache/cc2-wasm-source',out='.cache/h9-build';await mkdir(out,{recursive:true});
 const path=`${root}/src/bot.rs`,before=await readFile(path,'utf8'),after=transform(before);
 await writeFile(path,after);
 const f=`${root}/src/bot/freestyle.rs`;
 await writeFile(f,(await readFile(f,'utf8'))+'\n'+await readFile('tools/cc2-eval-audit/h9_off_tests.rs','utf8'));
 const sha=s=>createHash('sha256').update(s).digest('hex');
 await writeFile(`${out}/source-delta.json`,JSON.stringify({onlyProductionChange:'review_h9_h12.h9_cavity_excavation: -0.5 -> 0 via h9_off cfg',before:sha(before),after:sha(after),visibleT:false},null,2));
}
