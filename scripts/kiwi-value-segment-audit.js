// Offline provenance audit only. Never used by the bot or by a trainer.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {auditGame} from './kiwi-residual-arena-plan.js';

const source='.cache/linear-value-pilot/traces/residual-arena-traces-0/block-0/attempt-0/leg-0';
const out='docs/audits/cc2-alignment/VALUE_SEGMENT_AUDIT_2026-10-07.json';
const parse=name=>gunzipSync(readFileSync(`${source}/${name}.jsonl.gz`)).toString().trim().split('\n').map(JSON.parse);
const events=parse('events'),reports=parse('reports');
const game=JSON.parse(readFileSync(`${source}/result.json`));
assert.equal(auditGame(game,0,0,0).scored,true);
const decisions=events.map((e,index)=>({...e,index})).filter(e=>e.type==='decision');
for(const seat of [0,1]) {
  const ds=decisions.filter(e=>e.seat===seat),rs=reports.filter(e=>e.seat===seat);
  assert.equal(ds.length,game.counts.requests[seat]);assert.equal(ds.length,rs.length);
  ds.forEach((e,i)=>{assert.deepEqual(e.snapshot,rs[i].snapshot);assert.deepEqual(e.selected,rs[i].action);});
}

const samples=[];
// Fixed piece counts, both seats, one game. Not selected by outcome or symptoms.
for(const pieces of [0,16,64,128])for(const seat of [0,1]) {
  const root=decisions.find(e=>e.seat===seat&&e.snapshot.piecesPlaced===pieces&&!e.snapshot.hold.locked);
  const end=decisions.find(e=>e.seat===seat&&e.snapshot.piecesPlaced===pieces+6&&!e.snapshot.hold.locked);
  assert.ok(root&&end);
  const rs=root.snapshot,es=end.snapshot;
  assert.equal(es.frame-rs.frame,144);
  const ds=decisions.filter(e=>e.seat===seat&&e.index>=root.index&&e.index<end.index);
  const token=(id,value,knownAtRoot)=>({id,value,knownAtRoot});
  let current=token('C0',rs.current.type,true),held=rs.hold.piece?token('H0',rs.hold.piece,true):null;
  let queue=rs.next.map((p,i)=>token(`N${i+1}`,p,true)),unknown=0,placements=0;
  const steps=[],knownNames=['C0',...rs.next.map((_,i)=>`N${i+1}`),...(held?['H0']:[])];
  const project=t=>t?{id:t.id,piece:t.knownAtRoot?t.value:null,knownAtRoot:t.knownAtRoot}:null;
  for(let i=0;i<ds.length;i++) {
    const d=ds[i],s=d.snapshot,next=i+1<ds.length?ds[i+1].snapshot:es;
    assert.equal(current.value,s.current.type);assert.equal(held?.value??null,s.hold.piece);
    assert.deepEqual(queue.map(t=>t.value),s.next);
    const action=d.selected.action.kind;
    const step={requestFrame:s.frame,action,playedToken:project(current),
      informationAvailableToActualPolicy:{currentWasUnknownAtRoot:!current.knownAtRoot,
        holdWasUnknownAtRoot:held!==null&&!held.knownAtRoot,
        nextSlotsUnknownAtRoot:queue.filter(t=>!t.knownAtRoot).length},
      intendedPlacement:action==='place'?d.selected.move:null};
    if(action==='hold') {
      if(held) [current,held]=[held,current];
      else {held=current;current=queue.shift();queue.push(token(`U${++unknown}`,next.next.at(-1),false));}
      assert.equal(next.frame,s.frame);assert.equal(next.hold.locked,true);
    }else {
      assert.equal(action,'place');placements++;
      const parity=events.slice(d.index+1,end.index).find(e=>e.type==='parity'&&e.kind==='placement'&&e.seat===seat&&e.frame===s.frame+23);
      assert.ok(parity);assert.equal(parity.actual.locks.length,1);
      assert.deepEqual(parity.intent,d.selected);assert.deepEqual(parity.validated,d.validated);
      assert.deepEqual(parity.actual.clear,parity.validated.clear);
      assert.deepEqual(parity.actual.locks[0].cells,d.selected.move.cells);
      for(const key of ['piece','x','y','rotation'])assert.equal(parity.actual.locks[0][key],d.selected.move[key]);
      assert.equal(parity.actual.locks[0].spin,parity.validated.finalPiece.spin);
      assert.equal(parity.actual.locks[0].frame,s.frame+23);
      assert.equal(parity.actual.locks[0].piece,current.value);
      step.actualLock=parity.actual.locks[0];step.clear=parity.actual.clear;
      current=queue.shift();queue.push(token(`U${++unknown}`,next.next.at(-1),false));
      assert.equal(next.frame,s.frame+24);
    }
    step.newRevealCount=unknown;
    steps.push(step);
    assert.equal(current.value,next.current.type);assert.equal(held?.value??null,next.hold.piece);
    assert.deepEqual(queue.map(t=>t.value),next.next);
  }
  assert.equal(placements,6);
  const receives=events.slice(root.index+1,end.index).filter(e=>e.type==='receive'&&e.seat===seat)
    .map(e=>({frame:e.frame,phase:e.frame===es.frame?'endpoint-boundary':'during-prefix',offeredAmount:e.event.amt,newPacketAdmitted:e.cid!==null}));
  // This is only a count of admitted packets. OfferedAmount is NOT the admitted
  // amount: the authority may cross-cancel against its outgoing ledger first.
  const totalsAt=frame=>events.find(e=>e.seat===seat&&(e.frame??e.state?.frame)===frame&&(e.type==='anchor'||e.type==='initial'))?.state.attack.totals;
  const before=totalsAt(rs.frame),after=totalsAt(es.frame);assert.ok(before&&after);
  const transactionDelta=Object.fromEntries(['generated','cancelled','sent','tanked'].map(k=>[k,after[k]-before[k]]));
  assert.equal(transactionDelta.sent,es.attack.cumulativeSent-rs.attack.cumulativeSent);
  const exposed=steps.filter(s=>Object.values(s.informationAvailableToActualPolicy).some(Boolean));
  const usedUnknown=steps.filter(s=>s.action==='place'&&!s.playedToken.knownAtRoot);
  samples.push({id:`block0-leg0-seat${seat}-pieces${pieces}`,seat,rootPieces:pieces,
    rootAvailableInput:rs,
    offlineObservedContinuation:{steps,endpointSnapshot:es,receiveEvents:receives,
      transactionDelta,deltaFrames:144,deltaSent:transactionDelta.sent,
      rootKnownTokenIds:knownNames,endpointSupplyMaskedToRoot:{current:project(current),hold:project(held),next:queue.map(project)},
      newlyRevealedPieces:unknown,requestsExposedToPostRootInformation:exposed.length,
      locksUsingRootUnknownPieces:usedUnknown.length},
    offlineLabel:{winner:game.result.winner,win:seat===game.result.winner,
      interpretation:'Outcome under the executed behavior policies; not a sibling-action or optimal-value label.'},
    compatibility:{rootInputVerified:true,actualSixLocksAudited:true,
      newOpponentPacketCount:receives.filter(e=>e.newPacketAdmitted).length,
      actualEndpointIsSearchLeaf:false,
      reasons:['Executed later actions may depend on newly revealed previews; deleting those preview fields does not undo action-selection dependence.',
        ...(receives.some(e=>e.newPacketAdmitted)?['Actual continuation admits new opponent garbage that the current root forecast does not generate.']:[]),
        ...(usedUnknown.length?['Some executed placement pieces were not in the root-known supply.']:[]),
        'Reports retain root rankings, not the search best-chain leaf, its scenario state, or root-to-leaf attribution.'],
      acceptedAsTrainingRow:false}});
}
mkdirSync('docs/audits/cc2-alignment',{recursive:true});
const summary=samples.map(s=>({id:s.id,deltaSent:s.offlineObservedContinuation.deltaSent,
  generated:s.offlineObservedContinuation.transactionDelta.generated,
  cancelled:s.offlineObservedContinuation.transactionDelta.cancelled,
  tanked:s.offlineObservedContinuation.transactionDelta.tanked,
  holds:s.offlineObservedContinuation.steps.filter(x=>x.action==='hold').length,
  reveals:s.offlineObservedContinuation.newlyRevealedPieces,
  exposedRequests:s.offlineObservedContinuation.requestsExposedToPostRootInformation,
  rootUnknownLocks:s.offlineObservedContinuation.locksUsingRootUnknownPieces,
  newOpponentPackets:s.compatibility.newOpponentPacketCount,
  admittedDuringPrefix:s.offlineObservedContinuation.receiveEvents.filter(e=>e.newPacketAdmitted&&e.phase==='during-prefix').length,
  admittedAtEndpoint:s.offlineObservedContinuation.receiveEvents.filter(e=>e.newPacketAdmitted&&e.phase==='endpoint-boundary').length}));
const result={schema:'kiwi-value-segment-provenance/1',sourceRun:37452163955,
  selection:{block:0,leg:0,pieceCounts:[0,16,64,128],seats:[0,1],locksPerSegment:6},
  sourceHashes:Object.fromEntries(['events.jsonl.gz','reports.jsonl.gz','result.json'].map(n=>[n,createHash('sha256').update(readFileSync(`${source}/${n}`)).digest('hex')])),
  summary,samples,trainingRowsCreated:0,
  warning:'Everything under offlineObservedContinuation is retrospective evidence, not an online feature payload.'};
writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({summary,trainingRowsCreated:0,output:out},null,2));
