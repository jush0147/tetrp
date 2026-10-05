import test from 'node:test';
import assert from 'node:assert/strict';
import {instrument} from '../scripts/kiwi-tail-value-prepare.js';
test('frontier hook charges probe work, rejects duplicate/missing anchors and publishes only after full expansion',()=>{
 const source=['    dag: Dag<Eval>,','            dag: Dag::new(root, queue),','            let mut children: EnumMap<_, Vec<_>> = EnumMap::default();','                        children[next].push(ChildData {','            new_stats.expansions += 1;'].join('\n');
 const s=instrument(source);assert.ok(s.includes('budget-new_stats.nodes'));assert.ok(s.includes('new_stats.nodes+=cost'));
 assert.ok(s.includes('node.depth()==self.known_depth'));assert.ok(s.includes('node.cancel();new_stats.budget_exhausted=true;return new_stats;'));
 assert.throws(()=>instrument(s));assert.throws(()=>instrument(source.replace('    dag: Dag<Eval>,','')));
});
