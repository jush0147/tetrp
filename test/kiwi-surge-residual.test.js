import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformConfig,transformEval} from '../scripts/kiwi-surge-residual-prepare.js';
import {restore} from '../scripts/kiwi-surge-audit.js';
test('candidate override isolates bank weight; source patches reject ambiguous/repeated installation',()=>{
 const c='        config.freestyle_weights.pending_safety = 1.0;';
 assert.equal(transformConfig(c).replace('\n        if cfg!(surge_residual) { config.freestyle_weights.h3_surge_bank_value = 0.5; }',''),c);
 assert.throws(()=>transformConfig(c+c));assert.throws(()=>transformConfig(transformConfig(c)));
 const e='    eval += weights.h3_surge_bank_value * surge_bank as f32;';
 const out=transformEval(e);assert.ok(out.includes(e));assert.ok(out.includes('next_attack_multiplier()).floor()'));
 assert.throws(()=>transformEval(e+e));assert.throws(()=>transformEval(out));
});
test('fixed gate includes 8 charged public inputs and 12 prior controls; all restore',()=>{
 const read=p=>JSON.parse(readFileSync(p));
 const samples=[...read('docs/audits/cc2-alignment/perf-snapshots.json'),...read('docs/audits/cc2-alignment/SURGE_PUBLIC_INPUTS.json').samples];
 assert.equal(samples.length,20);assert.equal(samples.filter(x=>x.snapshot.attack.btb>x.snapshot.rules.b2bcharge_at).length,8);
 for(const s of samples)restore(s.snapshot);
});
