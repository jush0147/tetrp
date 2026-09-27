import assert from 'node:assert/strict';
export function scoreKO(score,result,swapped){
 assert.equal(result.reason,'topout');assert.ok(result.failures.every(f=>f===null));
 assert.ok(result.parity.every(p=>p.mismatches===0));
 assert.equal(result.ko.length,2);assert.ok(result.ko.some(Boolean));
 const scored=result.ko[0]!==result.ko[1];
 assert.equal(result.winner,scored?(result.ko[0]?1:0):null);
 const winner=scored?(swapped?1-result.winner:result.winner):null;
 const next=[...score];if(scored)next[winner]++;
 return {scored,seriesWinner:winner,score:next};
}
