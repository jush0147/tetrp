import assert from 'node:assert/strict';
export function shortPlan(leg){
 assert.ok(Number.isInteger(leg)&&leg>=0&&leg<4);
 return {policy:leg<2?'accepted':'h1-off',swapped:leg%2===1,seat:leg%2,seed:2026150001,frames:2400};
}
export function compareScores(on,off){
 const map=r=>Object.fromEntries(r.candidates.map(c=>[JSON.stringify(c.action),[c.mean_score,c.worst_score]]));
 const a=map(on),b=map(off),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
 return {candidateSetChanged:!same(Object.keys(a).sort(),Object.keys(b).sort()),
  changedScores:Object.keys(a).filter(k=>Object.hasOwn(b,k)&&!same(a[k],b[k])).length};
}
export function diagnosticOutcome(result){
 assert.ok(['topout','frame-cap'].includes(result.reason));
 if(result.reason==='frame-cap'){assert.equal(result.winner,null);return '100-placement horizon; unscored';}
 return 'KO observed; diagnostic only';
}
