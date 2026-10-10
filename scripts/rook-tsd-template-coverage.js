// Test whether template-only TSD generation hides legitimate SRS+ Full TSD.
// Evaluate ONLY pre-existing ROOK-owned public states with known next/Hold T.
import {readFileSync,writeFileSync} from 'node:fs';
import {findPublicTwoLockTsd} from '../src/analysis/rook-tsd-two-lock.js';
const records=readFileSync(process.env.ROOK_PUBLIC_LOCKS??
  'rook-all-public-locks.jsonl','utf8').trim().split('\n')
  .filter(Boolean).map(JSON.parse);
const candidates=records.filter(x=>x.kind==='rook'&&
  (x.visible.next?.[0]==='t'||x.visible.hold?.piece==='t'));
const rows=[];
for(const x of candidates){
  if(x.visible.next.length!==5||'bag' in x.visible||
    'holes' in x.visible||'rng' in x.visible)
    throw Error('Hidden information in public counterfactual');
  const original=JSON.stringify(x.visible);
  const common={firstStates:1200,secondStates:2400,
    maxSteps:70,maxPlans:4};
  const t0=performance.now();
  const templated=findPublicTwoLockTsd(x.visible,{...common,
    geometryPrescreen:true,secondProofCap:120});
  const templateMs=performance.now()-t0;
  const t1=performance.now();
  const direct=findPublicTwoLockTsd(x.visible,{...common,
    geometryPrescreen:false,secondProofCap:36});
  const directMs=performance.now()-t1;
  if(JSON.stringify(x.visible)!==original)throw Error('Public view mutated');
  rows.push({seed:x.seed,turn:x.turn,
    templateFound:templated.plans.length>0,
    templateProofs:templated.secondProofCalls,
    directFound:direct.plans.length>0,
    directProofs:direct.secondProofCalls,
    directTruncated:direct.truncated,
    missedByTemplate:direct.plans.length>0&&!templated.plans.length,
    templateMs:Math.round(templateMs),directMs:Math.round(directMs)});
}
const count=fn=>rows.filter(fn).length;
const report={format:'rook-two-lock-geometry-free-srs-control/1',
  publicRootStates:rows.length,
  independentSeeds:new Set(rows.map(x=>x.seed)).size,
  templateFound:count(x=>x.templateFound),
  uncensoredDirectFound:count(x=>x.directFound&&!x.directTruncated),
  directFound:count(x=>x.directFound),
  directTruncated:count(x=>x.directTruncated),
  newlyFoundWithoutTemplate:count(x=>x.missedByTemplate),
  extraSrsProofCalls:rows.reduce((n,r)=>n+r.directProofs-r.templateProofs,0),
  rows,
  caveat:'A 36 second-SRS-call cap is still a bounded search, not proof of nonexistence. SRS+ witnesses are exact for the two static hypothetical placements; incoming opponent garbage or new timing conditions may invalidate the route. This is not a KO.'};
if(process.env.ROOK_TWO_LOCK_GEOMETRY_OUTPUT)
  writeFileSync(process.env.ROOK_TWO_LOCK_GEOMETRY_OUTPUT,
    JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined}));
