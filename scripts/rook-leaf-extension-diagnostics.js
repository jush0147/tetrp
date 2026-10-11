// Controlled replay of ONLY archived player-visible Kiwi-vs-ROOK states.
// This measures action changes and the separate fifth-ply cost, NOT KO wins.
import {readFileSync,writeFileSync} from 'node:fs';
import {chooseMove} from '../src/analysis/rook.js';
import {actionSignature} from '../src/analysis/rook-disagreement.js';
const records=readFileSync(process.env.ROOK_PUBLIC_SNAPSHOTS??
  'rook-public-observations.jsonl','utf8').trim().split('\n').map(JSON.parse);
const earlier=readFileSync(process.env.ROOK_PREVIOUS_DIFF??
  'rook-choice-diff.jsonl','utf8').trim().split('\n').map(JSON.parse);
if(records.length!==earlier.length||records.length!==22)
  throw Error('Expected exact pinned real-public-position cohort');
const cfg={depth:4,beamWidth:24,maxNodes:6000,maxStates:1200,maxSteps:42};
const rows=[];
for(let i=0;i<records.length;i++){
  const {visible,seed,turn,owner}=records[i];
  if(visible.next.length!==5||'bag' in visible||'rng' in visible||
    'holes' in visible||earlier[i]?.seed!==seed)
    throw Error('Public snapshot invalid or identity mismatch');
  const frozen=JSON.stringify(visible),start=performance.now();
  const baseline=chooseMove(visible,cfg),baselineMs=performance.now()-start;
  if(actionSignature(baseline)!==earlier[i].rook.key)
    throw Error('Pinned default policy no longer reproduces archive');
  const begin=performance.now();
  const extended=chooseMove(visible,{...cfg,exactLeafExtension:true,
    leafExtensionBudget:5000,leafExtensionStates:800});
  const extendedMs=performance.now()-begin;
  if(JSON.stringify(visible)!==frozen)throw Error('Public view mutated');
  if(extended.diagnostics.evaluated>cfg.maxNodes||
    extended.diagnostics.leafExtensionEvaluated>5000)
    throw Error('Evaluation bound violated');
  const pending=[...(visible.attack?.pending??[]),
    ...(visible.attack?.are??[])].reduce((n,p)=>n+(p.amt??0),0);
  rows.push({seed,turn,owner,pending,
    changed:actionSignature(baseline)!==actionSignature(extended),
    baselineMatchesKiwi:actionSignature(baseline)===earlier[i].kiwi.key,
    extendedMatchesKiwi:actionSignature(extended)===earlier[i].kiwi.key,
    baselineMs:Math.round(baselineMs),extendedMs:Math.round(extendedMs),
    ...Object.fromEntries(['leafExtensionEvaluated','leafExtensionWitnesses',
      'leafExtensionApplied','leafExtensionAbort','leafExtensionChangesRoot']
      .map(k=>[k,extended.diagnostics[k]]))});
}
const count=fn=>rows.filter(fn).length;
const report={format:'rook-fifth-ply-real-public-screen/1',
  records:rows.length,independentSeeds:new Set(rows.map(r=>r.seed)).size,
  completed:count(r=>r.leafExtensionApplied),
  aborted:count(r=>!r.leafExtensionApplied),
  changed:count(r=>r.changed),
  baselineAgreesKiwi:count(r=>r.baselineMatchesKiwi),
  extensionAgreesKiwi:count(r=>r.extendedMatchesKiwi),
  additionalEvaluations:rows.reduce((n,r)=>n+r.leafExtensionEvaluated,0),
  abortReasons:Object.fromEntries([...new Set(rows.map(r=>r.leafExtensionAbort))]
    .filter(Boolean).map(k=>[k,count(r=>r.leafExtensionAbort===k)])),rows};
if(process.env.ROOK_LEAF_OUTPUT)writeFileSync(process.env.ROOK_LEAF_OUTPUT,
  JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined,
  disclaimer:'Overlapping public positions from 2 seeds; agreement with Kiwi is NOT KO performance'}));
