import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export function transform(source){
 const anchor='        config.freestyle_weights.pending_safety = 1.0;';
 assert.equal(source.split(anchor).length,2,'Expected unique accepted profile anchor');
 return source.replace(anchor,anchor+'\n        if cfg!(b2b_leaf_off) { config.freestyle_weights.has_back_to_back = 0.0; }');
}
if(process.argv[2]==='install'){
 const root=process.argv[3]??'.cache/cc2-wasm-source',out='.cache/b2b-leaf-build';await mkdir(out,{recursive:true});
 const path=`${root}/src/bot.rs`,before=await readFile(path,'utf8'),after=transform(before);await writeFile(path,after);
 const f=`${root}/src/bot/freestyle.rs`;await writeFile(f,(await readFile(f,'utf8'))+'\n'+await readFile('tools/cc2-eval-audit/b2b_leaf_off_tests.rs','utf8'));
 const sha=x=>createHash('sha256').update(x).digest('hex');
 await writeFile(`${out}/source-delta.json`,JSON.stringify({onlyProductionChange:'review_h9_h12.has_back_to_back: 0.5 -> 0',before:sha(before),after:sha(after)},null,2));
}
