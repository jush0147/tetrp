import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {VARIANT} from './kiwi-surge-variant.js';
export function transformConfig(source,v=VARIANT){
 assert.ok(!source.includes('cfg!(surge_residual)'),'Already installed');
 const method='    pub fn review_h9_h12() -> Self {';assert.equal(source.split(method).length,2);
 const start=source.indexOf(method),end=source.indexOf('\n    }',start);assert.ok(end>start);
 const block=source.slice(start,end),anchor='        config.freestyle_weights.h3_surge_bank_value = 0.0;';
 assert.equal(block.split(anchor).length,2,'Expected single bank initialization in review profile');
 assert.equal((block.match(/h3_surge_bank_value\s*=/g)??[]).length,1,'Additional bank assignment would override candidate');
 const rust=x=>Number.isInteger(x)?x.toFixed(1):String(x);
 assert.equal((block.match(/has_back_to_back\s*=/g)??[]).length,0,'Unexpected Boolean override');
 const replacement='        config.freestyle_weights.h3_surge_bank_value = if cfg!(surge_residual) { '+rust(v.bank)+' } else { 0.0 };'+(v.boolean===0.5?'':'\n        if cfg!(surge_residual) { config.freestyle_weights.has_back_to_back = '+rust(v.boolean)+'; }');
 return source.slice(0,start)+block.replace(anchor,replacement)+source.slice(end);
}
export function transformEval(source){
 assert.ok(!source.includes('cfg!(surge_residual)'),'Already installed');
 const anchor='    eval += weights.h3_surge_bank_value * surge_bank as f32;';assert.equal(source.split(anchor).length,2);
 return source.replace(anchor,`    // Candidate values gross stored attack, not sent or a promised legal release.
    // Public forecast clock supplies the next lock multiplier; pending is not subtracted.
    if cfg!(surge_residual) {
        eval += weights.h3_surge_bank_value * (surge_bank as f64 * state.forecast.next_attack_multiplier()).floor() as f32;
    } else {
${anchor}
    }`);
}
if(process.argv[2]==='install'){
 const root=process.argv[3]??'.cache/cc2-wasm-source',out='.cache/surge-residual-build';await mkdir(out,{recursive:true});
 const config=await readFile(`${root}/src/bot.rs`,'utf8'),evalSource=await readFile(`${root}/src/bot/freestyle.rs`,'utf8');
 const afterConfig=transformConfig(config),afterEval=transformEval(evalSource);
 await writeFile(`${root}/src/bot.rs`,afterConfig);
 await writeFile(`${root}/src/bot/freestyle.rs`,afterEval+'\n'+(await readFile('tools/cc2-eval-audit/surge_residual_tests.rs','utf8')).replaceAll('CANDIDATE_BANK',VARIANT.bank.toFixed(1)).replaceAll('CANDIDATE_BOOLEAN',VARIANT.boolean.toFixed(1)));
 const sha=x=>createHash('sha256').update(x).digest('hex');
 await writeFile(`${out}/source-delta.json`,JSON.stringify({variant:VARIANT,hypothesis:'bank weight * floor(charged bank base units * public next-lock multiplier), leaf only; pending not deducted',before:{config:sha(config),evaluator:sha(evalSource)},after:{config:sha(afterConfig),evaluator:sha(afterEval)}},null,2));
}
