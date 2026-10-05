import test from 'node:test';
import assert from 'node:assert/strict';
import {instrument,instrumentAllocation} from '../scripts/kiwi-tail-value-prepare.js';
test('frontier hook charges probe work, rejects duplicate/missing anchors and publishes only after full expansion',()=>{
 const source=['    dag: Dag<Eval>,','            dag: Dag::new(root, queue),','            let mut children: EnumMap<_, Vec<_>> = EnumMap::default();','                    for (mv, sd_distance) in selected {','                        children[next].push(ChildData {','            new_stats.expansions += 1;'].join('\n');
 const s=instrument(source);assert.ok(s.includes('saturating_sub(reserve)'));assert.ok(s.includes('new_stats.nodes+=cost'));
 assert.ok(s.includes('node.depth()==self.known_depth'));assert.ok(s.includes('if cfg!(tail_value_candidate){value}else{eval}'));
 assert.throws(()=>instrument(s));assert.throws(()=>instrument(source.replace('    dag: Dag<Eval>,','')));
});
test('allocation instrumentation is single-use and rejects an unknown source layout',()=>{
 const s='        let mut stats = Statistics::default();';
 assert.ok(instrumentAllocation(s).includes('begin(allocation)'));
 assert.throws(()=>instrumentAllocation(instrumentAllocation(s)));assert.throws(()=>instrumentAllocation(''));
});
