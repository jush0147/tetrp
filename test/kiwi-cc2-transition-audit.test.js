import test from 'node:test';
import assert from 'node:assert/strict';
import {differences} from '../scripts/kiwi-cc2-transition-audit.js';

// Comparator contract only. This fixture is deliberately not called Rust evidence.
function paired(){
  const c={id:'contract',expected:{cols:Array(10).fill('0'),garbageRows:'0',combo:1,btb:2,pieces:21,
    cumulativeSent:4,pending:[{amt:3,ready:25,active:false}],elapsed:24,
    clear:{lines:1,garbageRows:0,allClear:false},spin:'full',cells:[[3,39],[4,39],[5,39],[4,38]],
    packets:[3],totals:{generated:3,cancelled:1,sent:2,tanked:0},lockMultiplier:1}};
  const a=c.expected,r={id:c.id,after:{cols:a.cols,garbageRows:a.garbageRows,combo:1,btb:2,
    forecast:{pieces:21,sent:4,pending:[{...a.pending[0],hypotheticalHole:0}],elapsed:24}},
    clear:a.clear,placement:{spin:a.spin},cells:a.cells.map(([x,y])=>[x,39-y]),packets:[3],generated:3,
    lockMultiplier:1,events:[{kind:'attack',generated:3,cancelled:1,sent:2}]};
  return {c,r};
}
test('comparator converts coordinate systems and ignores no relevant transaction fields',()=>{
  const {c,r}=paired();assert.deepEqual(differences(c,r).fields,[]);
  r.after.forecast.pending[0].active=true;r.placement.spin='mini';r.after.cols=[...r.after.cols];r.after.cols[0]='1099511627776';
  assert.deepEqual(differences(c,r).fields,['cols','pending','spin']);
});
test('comparator detects packet order, cancellation, tank and counter differences',()=>{
  const {c,r}=paired();r.packets=[1,2];r.events[0].cancelled=2;r.events.push({kind:'tank',hole:0});r.after.btb=0;
  assert.deepEqual(differences(c,r).fields,['btb','packets','cancelled','tanked']);
});
test('driver error, wrong row identity and incomplete output are technical failures',()=>{
  const {c,r}=paired();assert.throws(()=>differences(c,{id:c.id,error:'bad input'}));
  assert.throws(()=>differences(c,{...r,id:'other'}));assert.throws(()=>differences(c,{id:c.id}));
});
