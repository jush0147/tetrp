import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {variant,candidateConfig} from '../scripts/kiwi-surge-variant.js';
import {transformConfig as transformVariant,transformEval} from '../scripts/kiwi-surge-residual-prepare.js';
const transformConfig=s=>transformVariant(s,variant('residual'));
import {restore} from '../scripts/kiwi-surge-audit.js';
test('candidate override isolates bank weight; source patches reject ambiguous/repeated installation',()=>{
 const c='    pub fn review_h9_h12() -> Self {\n        config.freestyle_weights.pending_safety = 1.0;\n        config.freestyle_weights.h3_surge_bank_value = 0.0;\n        config\n    }';
 assert.equal(transformConfig(c).replace('if cfg!(surge_residual) { 0.5 } else { 0.0 }','0.0'),c);
 assert.throws(()=>transformConfig(c+c));assert.throws(()=>transformConfig(transformConfig(c)));
 const e='    eval += weights.h3_surge_bank_value * surge_bank as f32;';
 const out=transformEval(e);assert.ok(out.includes(e));assert.ok(out.includes('next_attack_multiplier()).floor()'));
 assert.throws(()=>transformEval(e+e));assert.throws(()=>transformEval(out));
});
test('replace final bank initialization, leaving other profiles untouched and no later reset',()=>{
 const zero='        config.freestyle_weights.h3_surge_bank_value = 0.0;';
 const other=`    pub fn corrected_legacy_h12() -> Self {\n${zero}\n    }\n`;
 const review=`    pub fn review_h9_h12() -> Self {\n        config.freestyle_weights.pending_safety = 1.0;\n${zero}\n        config\n    }`;
 const transformed=transformConfig(other+review);assert.ok(transformed.startsWith(other));
 const body=transformed.slice(other.length);assert.equal(body.includes(zero),false);
 assert.equal((body.match(/h3_surge_bank_value\s*=/g)??[]).length,1);
 assert.throws(()=>transformConfig(review.replace(zero,zero+'\n'+zero)));
});
test('fixed gate includes 8 charged public inputs and 12 prior controls; all restore',()=>{
 const read=p=>JSON.parse(readFileSync(p));
 const samples=[...read('docs/audits/cc2-alignment/perf-snapshots.json'),...read('docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json').samples];
 assert.equal(samples.length,20);assert.equal(samples.filter(x=>x.snapshot.attack.btb>x.snapshot.rules.b2bcharge_at).length,8);
 for(const s of samples)restore(s.snapshot);
});

test('fixed variants isolate both coefficients in the real accepted profile',()=>{
 const original=JSON.parse(readFileSync('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config;
 const profile='    pub fn review_h9_h12() -> Self {\n        config.freestyle_weights.h3_surge_bank_value = 0.0;\n        config\n    }';
 for(const [name,b,k] of [['residual',0.5,0.5],['boolean-off',0,0.5],['both-one',1,1]]){
  const v=variant(name),c=candidateConfig(original,v),expected=structuredClone(original);
  expected.freestyle_weights.has_back_to_back=b;expected.freestyle_weights.h3_surge_bank_value=k;assert.deepEqual(c,expected);
  const source=transformVariant(profile,v);assert.ok(source.includes('if cfg!(surge_residual) { '+k.toFixed(1)+' } else { 0.0 }'));
  if(b!==0.5)assert.ok(source.includes('if cfg!(surge_residual) { config.freestyle_weights.has_back_to_back = '+b.toFixed(1)+'; }'));
 }
 assert.throws(()=>variant('typo'));assert.equal(original.freestyle_weights.has_back_to_back,0.5);
});

test('clear-off zeros exactly three tables; no Boolean or bank candidate inherited',()=>{
 const original=JSON.parse(readFileSync('docs/audits/cc2-alignment/ACTIVE_PARAMETERS_2026-09-28.json')).config;
 const expected=structuredClone(original);for(const k of ['normal_clears','mini_spin_clears','spin_clears'])expected.freestyle_weights[k].fill(0);
 assert.deepEqual(candidateConfig(original,variant('clear-off')),expected);
 const source='    pub fn review_h9_h12() -> Self {\n        config.freestyle_weights.h3_surge_bank_value = 0.0;\n        config\n    }';
 const patched=transformVariant(source,variant('clear-off'));
 assert.ok(patched.includes('h3_surge_bank_value = 0.0;'));assert.ok(!patched.includes('has_back_to_back ='));
 for(const [k,n] of [['normal_clears',5],['mini_spin_clears',3],['spin_clears',4]])assert.ok(patched.includes(k+' = [0.0; '+n+'];'));
 assert.throws(()=>transformVariant(source.replace('        config\n','        config.freestyle_weights.normal_clears = [0.0;5];\n        config\n'),variant('clear-off')));
});
