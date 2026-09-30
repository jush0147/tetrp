import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import readline from 'node:readline';
import {summarizeDense} from './kiwi-cc2-dense-integration-summary.js';
import {validatePlacement} from '../src/analysis/placement-authority.js';
const root='.cache/visible-t-pilot-36707273929',reports=[],legs=[];
const cellKey=c=>c.map(p=>p.join(',')).sort().join(';');
let placements=0,holds=0,reanalyses=0,decisions=0;
for(const folder of (await readdir(`${root}/legs`)).sort()){
 const dir=`${root}/legs/${folder}`,r=JSON.parse(await readFile(`${dir}/result.json`,'utf8'));reports.push(r);
 for(const game of r.games){
  const snapshot=[null,null],selected=[null,null],held=[null,null],local={placements:[0,0],holds:[0,0],reanalyses:[0,0]};
  const stream=readline.createInterface({input:createReadStream(`${dir}/game-${game.game}.jsonl`)});
  for await(const line of stream){const e=JSON.parse(line),seat=e.seat;
   assert.notEqual(e.type,'failure');
   if(e.type==='decision'){
    decisions++;assert.equal(e.selected.candidateIndex,0);assert.equal(e.snapshot.next.length,5);
    if(held[seat]){for(const k of ['current','hold','next','frame'])assert.deepEqual(e.snapshot[k],held[seat][k]);assert.equal(e.selected.action.kind,'place');held[seat]=null;reanalyses++;local.reanalyses[seat]++;}
    snapshot[seat]=e.snapshot;selected[seat]=e.selected;
   }
   if(e.type==='parity'){
    assert.deepEqual(e.intent,selected[seat]);assert.equal(e.intent.candidateIndex,0);
    if(e.kind==='placement'){
     const proof=validatePlacement(snapshot[seat],e.intent),lock=e.actual.locks[0];
     assert.deepEqual(proof,e.validated);assert.equal(e.actual.locks.length,1);
     for(const k of ['piece','x','y','rotation','spin'])assert.equal(lock[k],proof.intent[k]);
     assert.equal(cellKey(lock.cells),cellKey(proof.intent.cells));assert.deepEqual(e.actual.clear,proof.clear);
     assert.equal(lock.frame,e.frame);assert.equal(lock.frame,snapshot[seat].frame+23);assert.equal(lock.subframe,.5);
     placements++;local.placements[seat]++;
    }else{
     assert.equal(e.kind,'hold');const s=snapshot[seat],a=e.actual;
     assert.equal(a.frame,s.frame);assert.equal(a.current.type,s.hold.piece??s.next[0]);
     assert.equal(a.hold.piece,s.current.type);assert.equal(a.hold.locked,true);
     assert.deepEqual(a.next.slice(0,s.hold.piece===null?4:5),s.hold.piece===null?s.next.slice(1):s.next);
     held[seat]=a;holds++;local.holds[seat]++;
    }
   }
  }
  for(const key of Object.keys(local))assert.deepEqual(local[key],game.counts[key]);
  assert(held.every(h=>h===null),'unexpected unanalysed Hold');
  legs.push({leg:r.batchLeg,seed:game.seeds[0],swapped:game.swapped,winner:game.seriesWinner,frames:game.frames,deathReasons:game.deathReasons,placements:game.counts.placements,sent:game.sent});
 }
}
const summary=summarizeDense(reports,'success',{visibleT:true});assert(summary.complete);
const online=JSON.parse(await readFile(`${root}/summary/cc2-visible-t-integration-summary.json`,'utf8'));delete online.readErrors;assert.deepEqual(summary,online);
const result={run:36707273929,summary,rawAudit:{decisions,placements,holds,reanalyses,mismatches:0,authorityCertificatesRevalidated:placements},legs,
 interpretation:'Eight KO games from four paired seeds. Valid pilot evidence, not evidence of improvement or a conclusive regression. Do not assume paired legs are independent samples.'};
await writeFile('docs/audits/cc2-alignment/VISIBLE_T_PILOT_RESULT.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
