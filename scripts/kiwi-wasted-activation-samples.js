import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// Selection uses only public T availability and chronological position.
// No policy scores, chosen actions, winners or future information are read.
export function selectActivation(rows,leg,limit=32){
 assert.ok(Number.isInteger(limit)&&limit>=2&&limit<=32);
 const eligible=rows.filter(r=>r.snapshot.current.type==='t'||(!r.snapshot.hold.locked&&r.snapshot.hold.piece==='t'));
 const count=Math.min(limit,eligible.length);
 const indices=Array.from({length:count},(_,i)=>count<2?0:Math.floor(i*(eligible.length-1)/(count-1)));
 return {eligible:eligible.length,samples:indices.map(i=>{
  const r=eligible[i],snapshot=structuredClone(r.snapshot);
  return {id:`short37023218685/leg${leg}/request${r.request}`,snapshot,
   snapshotHash:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};
 })};
}
