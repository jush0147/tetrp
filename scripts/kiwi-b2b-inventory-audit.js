// Authority witnesses and frozen-source evidence; not a replacement rule engine.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createAttack,resolveAttack,pendingCount} from '../src/attack.js';
import {ruleset} from '../src/rules.js';
import {createHoles} from '../src/random.js';
const dir='docs/audits/cc2-alignment',sha=x=>createHash('sha256').update(x).digest('hex');
const source=await readFile('.cache/cc2-parameter-audit/src/bot/freestyle.rs','utf8');
const config=JSON.parse(await readFile(`${dir}/ACTIVE_PARAMETERS_2026-09-28.json`,'utf8')).config;
assert.equal(config.freestyle_weights.has_back_to_back,0.5);
assert.equal(config.freestyle_weights.h3_b2b_charge_value,0);
assert.equal(config.freestyle_weights.h3_surge_bank_value,0);
assert.equal(config.freestyle_weights.tetrio_s2,false);
for(const s of ['eval += weights.has_back_to_back','reward += weights.useful_attack_reward * useful_outgoing','eval += weights.h3_surge_bank_value * surge_bank','if !back_to_back || !rules.b2b_charging'])assert.ok(source.includes(s));
function witness(id,{btb=8,lines=1,spin='none',pending=0,multiplier=1,combo=0,overrides={}}={}){
 const s=createAttack(),rules=ruleset('tl',overrides);
 Object.assign(s,{btb,combo,multiplier,pieces:30});
 if(pending)s.pending.push({amt:pending,active:true,hardened:false,shielded:false});
 const result=resolveAttack(s,{lines,spin,allClear:false,garbageRows:0},rules,createHoles(1));
 return {id,input:{btb,lines,spin,pending,multiplier,combo,overrides},result,after:{btb:s.btb,combo:s.combo,pending:pendingCount(s),...s.totals},surgeGenerated:result.surge.reduce((n,p)=>n+p.generated,0),surgeSent:result.surge.reduce((n,p)=>n+p.sent,0)};
}
const witnesses=[witness('below-threshold',{btb:4}),witness('first-charged',{btb:5}),witness('banked-8'),witness('banked-8-cancel',{pending:4}),witness('banked-8-multiplier',{multiplier:1.5}),witness('banked-8-nonclear',{lines:0}),witness('banked-8-mini',{spin:'mini'}),witness('banked-8-full-double',{lines:2,spin:'full'}),witness('charging-disabled',{overrides:{b2bcharging:false}}),witness('custom-base3',{overrides:{b2bcharge_base:3}})];
assert.deepEqual(witnesses.map(w=>w.surgeGenerated),[0,1,4,4,6,0,0,0,0,7]);
assert.equal(witnesses[3].surgeSent,0);assert.equal(witnesses[3].after.cancelled,4);
assert.equal(witnesses[5].after.btb,8);assert.equal(witnesses[6].after.btb,9);
const activation=JSON.parse(await readFile(`${dir}/WASTED_T_ACTIVATION_INPUTS.json`,'utf8'));
const samples=[...JSON.parse(await readFile(`${dir}/perf-snapshots.json`,'utf8')),...activation.samples];
const rootHistogram={};for(const {snapshot:v} of samples){assert.equal(v.next.length,5);rootHistogram[v.attack.btb]=(rootHistogram[v.attack.btb]??0)+1;}
const report={schema:'b2b-inventory-audit/1',scope:'Actual authority transaction witnesses, source review and existing public-root distribution. No Rust execution or search-leaf attribution; synthetic transactions do not prove geometry reachability.',hashes:{freestyle:sha(source),attack:sha(await readFile('src/attack.js')),config:sha(JSON.stringify(config))},weights:{has_back_to_back:0.5,h3_b2b_charge_value:0,h3_surge_bank_value:0},rootHistogram,sampleCount:samples.length,witnesses};
await writeFile(`${dir}/B2B_INVENTORY_EVIDENCE.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sampleCount:samples.length,rootHistogram,witnesses:witnesses.map(w=>({id:w.id,generated:w.surgeGenerated,sent:w.surgeSent,btb:w.after.btb}))},null,2));
