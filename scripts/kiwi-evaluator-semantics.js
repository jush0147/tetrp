// Source audit + authority transaction witnesses. Not a Rust evaluator emulator.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as A from '../src/attack.js';
import {ruleset} from '../src/rules.js';
import {createHoles} from '../src/random.js';

const dir='docs/audits/cc2-alignment';
const inventory=JSON.parse(await readFile(`${dir}/ACTIVE_PARAMETERS_2026-09-28.json`,'utf8'));
const source=await readFile('.cache/cc2-parameter-audit/src/bot/freestyle.rs','utf8');
const block=source.split('pub struct Weights {')[1].split('\n}')[0];
const declared=[...block.matchAll(/pub (\w+):/g)].map(m=>m[1]);
const groups=[
  ['transaction',['useful_attack_reward','cancellation_reward'],'Forecast sent delta; cleared-transition pending reduction. Exact within the modeled scenario, not a prediction of opponent response.'],
  ['legacy-clear-shaping',['normal_clears','mini_spin_clears','spin_clears','back_to_back_clear','combo_attack'],'Extra edge preferences, NOT the TL attack formula; combined with sent reward.'],
  ['all-clear-shaping',['perfect_clear','perfect_clear_override'],'Board-empty reward; override only suppresses legacy clear/B2B/combo shaping. Not conditional on rules.all_clears.'],
  ['t-resource-shaping',['wasted_t'],'T-only cost except full spin clearing >=2; not an opportunity-cost calculation from visible alternatives.'],
  ['b2b-inventory',['has_back_to_back','h3_b2b_charge_value','h3_surge_bank_value'],'Boolean inventory is active; extra charge/bank weights are zero. Released attack still enters transaction.'],
  ['pending-pressure',['pending_safety'],'Real post-transition board; pending quantity multiplies shared board coefficients without time-to-arrival weighting.'],
  ['base-holes',['holes','cell_coveredness','max_cell_covered_height','h6_base_holes_scale','h6_base_coveredness_scale'],'Base board after optimistic T-slot cutouts. Shared holes/coverage coefficients also affect real-board pending pressure; H6 scales do not.'],
  ['height',['height','height_upper_half','height_upper_quarter'],'Base max height after cutouts; upper-height coefficients also affect real-board pending pressure. No exact spawn-escape proof.'],
  ['surface',['row_transitions'],'After cutouts; counts horizontal filled/empty transitions with walls. Not landing reachability.'],
  ['well',['tetris_well_depth'],'After cutouts; lowest-column geometric well, no available-I or execution certificate check.'],
  ['cavity',['h9_cavity_excavation'],'Real board empty-component minimum vertical blockers; lower-bound excavation proxy, not a legal downstack path.'],
  ['tslot',['tslot'],'Synthetic bag and normalized reserve control number of optimistic cutouts; array zero does not disable board rewriting.'],
  ['transport',['softdrop'],'Zero in placement profile. Nonzero would import movegen cost while authority root cost is supplied as zero.'],
  ['evaluator-switch',['tetrio_s2'],'False only selects legacy-shaping evaluator branch; does not disable TL transitions.'],
  ['inactive-old-s2',['attack_reward','surge_value','b2b_charge_value','legacy_shape_value'],'Inactive under tetrio_s2=false; do not enable without reviewing multiplier/default-rule and double-reward semantics.'],
];
const mapped=groups.flatMap(g=>g[1]);
assert.equal(new Set(mapped).size,mapped.length,'duplicate field');
assert.deepEqual([...mapped].sort(),[...declared].sort(),'unclassified Weights field');
assert.deepEqual([...declared].sort(),Object.keys(inventory.config.freestyle_weights).sort(),'inventory mismatch');
for(const fragment of ['state.bag.contains(Piece::T)','state.reserve == Piece::T','state.bag.len() <= 3','state.board = board','reward += weights.useful_attack_reward * useful_outgoing','if !info.perfect_clear || !weights.perfect_clear_override'])assert(source.includes(fragment),fragment);
const fields=groups.flatMap(([group,names,semantics])=>names.map(name=>({name,value:inventory.config.freestyle_weights[name],group,semantics,
  execution:group==='inactive-old-s2'?'inactive-branch':typeof inventory.config.freestyle_weights[name]==='boolean'?'switch':inventory.config.freestyle_weights[name]===0?'zero-weight':'active',
  sourceLine:source.split('\n').findIndex(l=>l.includes(`pub ${name}:`))+1,
  usefulness:'not established by this source audit'})));

// Exercise the actual authority transaction, not a second gameplay model.
function witness(id,{lines=2,spin='full',allClear=false,garbageRows=0,pending=0,pieces=20,combo=0,btb=0,multiplier=1,overrides={}}={}){
  const rules=ruleset('tl',overrides),s=A.createAttack();
  Object.assign(s,{pieces,combo,btb,multiplier});
  if(pending)s.pending.push({amt:pending,active:true,hardened:false,shielded:false});
  const transaction=A.resolveAttack(s,{lines,spin,allClear,garbageRows},rules,createHoles(1));
  return {id,input:{lines,spin,allClear,garbageRows,pending,pieces,combo,btb,multiplier,overrides},transaction,
    actual:{generated:s.totals.generated,cancelled:s.totals.cancelled,sent:s.totals.sent,combo:s.combo,btb:s.btb,pending:A.pendingCount(s)}};
}
const witnesses=[witness('tsd-send'),witness('tsd-cancel',{pending:4}),witness('tsd-opener-defense',{pending:8,pieces:0}),
  witness('tsd-double-multiplier',{multiplier:2}),witness('tsd-garbage-bonus',{garbageRows:1}),
  witness('pc-enabled',{lines:2,spin:'none',allClear:true}),witness('pc-bonus-disabled',{lines:2,spin:'none',allClear:true,overrides:{allclears:false}}),
  witness('normal-single-surge',{lines:1,spin:'none',btb:8}),witness('normal-single-uncharged',{lines:1,spin:'none',btb:0})];
assert.equal(witnesses[0].actual.sent,4);assert.equal(witnesses[1].actual.sent,0);assert.equal(witnesses[1].actual.cancelled,4);
assert.equal(witnesses[2].actual.cancelled,8);assert.equal(witnesses[3].actual.sent,8);
assert.equal(witnesses[4].actual.sent,5);assert(witnesses[5].actual.sent>witnesses[6].actual.sent);
assert(witnesses[7].actual.sent>witnesses[8].actual.sent);
const sha=s=>createHash('sha256').update(s).digest('hex');
const report={schema:'kiwi-evaluator-semantics/1',date:'2026-09-29',artifactRun:inventory.artifactRun,
  scope:'Source coverage and actual JS authority transaction examples; no Rust evaluation execution, no ranking attribution, no arena or strength evidence.',
  sourceHashes:{acceptedFreestyle:sha(source),authorityAttack:sha(await readFile('src/attack.js','utf8'))},
  fieldCount:fields.length,scalarNumericCount:fields.reduce((n,f)=>n+(Array.isArray(f.value)?f.value.length:typeof f.value==='number'?1:0),0),fields,witnesses};
await writeFile(`${dir}/evaluator-semantic-evidence.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({fields:report.fieldCount,numericEntries:report.scalarNumericCount,witnesses:witnesses.map(w=>({id:w.id,...w.actual}))},null,2));
