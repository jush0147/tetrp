import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyze,recommendation} from '../src/analysis/native/search.js';
import {analyzeFrontier} from '../src/analysis/native/frontier.js';
import {match} from '../scripts/kiwi-arena-core.js';
const snapshot=()=>JSON.parse(readFileSync(new URL('../docs/audits/kiwi-ft7-35765171232/g1-f120.json',import.meta.url))).snapshot;
test('APP ranks cumulative generated attack per actual speculative placement with no board penalties',()=>{
  let checks=0,attacks=0;
  const s=snapshot(),before=JSON.stringify(s);
  const r=analyze(s,{objective:'generated-app',horizon:3,geometryBudget:1000000},ns=>{
    for(const n of ns){
      const expected=n.outcomes.reduce((sum,o)=>sum+o.state.attack.totals.generated/n.depth+(o.state.dead?-1e6:0),0)/n.outcomes.length;
      assert.ok(Math.abs(n.score-expected)<1e-8);checks++;if(n.reward>0)attacks++;
    }
  });
  assert.equal(r.completedDepth,3);assert.ok(checks>0&&attacks>0);
  assert.deepEqual(r.config.weights,{sent:1,load:0,coveredEmpty:0,height:0});assert.equal(JSON.stringify(s),before);
  assert.throws(()=>analyzeFrontier(s,{objective:'generated-app'}),/OBJECTIVE_UNSUPPORTED/);
  assert.throws(()=>analyze(s,{objective:'bad'}),/OBJECTIVE_INVALID/);
});
test('APP top-1 runs through strict authority arena without fallback (bounded diagnostic, no strength score)',async()=>{
  const bot=s=>recommendation(analyze(s,{objective:'generated-app',horizon:2,geometryBudget:1000000}));
  const r=await match([bot,bot],{maxFrames:96});
  assert.ok(r.failures.every(x=>!x));assert.equal(r.winner,null);
  for(let i=0;i<2;i++){
    assert.equal(r.parity[i].placements,4);assert.equal(r.parity[i].mismatches,0);
    assert.equal(r.transportStats[i].fallbackRequests,0);
  }
});
