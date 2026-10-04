import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {identities,BUILD} from './kiwi-evaluator-confirm-identity.js';
import {PLAN} from './kiwi-evaluator-confirm-plan.js';
import {nativeClient} from './kiwi-native-client.js';
import {prepareKiwi,normalizeTopRecommendation} from '../src/analysis/kiwi.js';
import {match} from './kiwi-arena-core.js';
const evidence={purpose:'two-native orchestration smoke, no strength score',identities:await identities(),complete:false,runs:[]};
try{
 for(const candidateSeat of [0,1]){
  const clients=[0,1].map(i=>nativeClient(resolve(BUILD,i===candidateSeat?'snapshot-surge-residual':'snapshot-accepted')));
  try{
   const bots=clients.map(client=>async v=>{
    const p=prepareKiwi(v),r=await client.request(JSON.stringify(p.request));
    assert.equal(v.next.length,5);assert.equal(r.node_budget,PLAN.nodeBudget);assert.ok(r.nodes>0&&r.nodes<=PLAN.nodeBudget);
    assert.equal(r.bag_knowledge,'unknown');assert.equal(r.unknown_tail,'finite_visible');
    return normalizeTopRecommendation(v,p,r);
   });
   const r=await match(bots,{seeds:[2026190001,2026190001],holeSeeds:[2026190002,2026190003],framesPerPiece:24,maxFrames:48,parallelDecisions:true});
   evidence.runs.push({candidateSeat,result:r});
   assert.ok(r.failures.every(f=>f===null));assert.ok(r.parity.every(p=>p.mismatches===0&&p.placements===2));
   assert.ok(r.transportStats.every(t=>t.fallbackRequests===0&&t.rejectedCandidates===0&&t.maxSelectedRank===0));
  }finally{for(const c of clients)await c.close();}
 }
 evidence.complete=true;
}catch(e){evidence.error={message:e.message,stack:e.stack};throw e;}
finally{await writeFile(`${BUILD}/confirmation-smoke.json`,JSON.stringify(evidence,null,2)+'\n');}
