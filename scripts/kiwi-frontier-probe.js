// Offline one-placement diagnostic. Never imported by policy, viewer or arena.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {fromSnapshot,clone,holdState,scenarios,place,leaf,stateKey} from '../src/analysis/native/model.js';
import {generate} from '../src/analysis/native/movegen.js';
import {cells,pack} from '../src/analysis/native/board.js';
import {PlacementArenaEngine,validatePlacement,commitPlacement} from '../src/analysis/placement-authority.js';
import {visibleState} from '../src/analysis/visible-state.js';

const weights={sent:1,load:1,coveredEmpty:1,height:1};
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const cellKey=cs=>cs.map(c=>c.join(',')).sort().join(';');
const close=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`);
function moves(s,rules){
  const g=generate(s.board,s.current,rules,{paths:true,maxStates:60000});
  assert.equal(g.complete,true,'Probe must not silently truncate move generation');
  return g;
}
function record(source,move,outcome,held){
  const l=leaf(outcome.state,weights),delta=k=>outcome.state.attack.totals[k]-source.attack.totals[k];
  return {held,piece:move.piece.type,x:move.piece.x,y:Math.ceil(move.piece.y),rotation:move.piece.r,
    cells:cells(move.piece),spin:move.piece.spin,path:move.path,clear:outcome.clear,
    generated:delta('generated'),cancelled:delta('cancelled'),sent:outcome.sent,
    btbBefore:source.attack.btb,btbAfter:outcome.state.attack.btb,
    comboBefore:source.attack.combo,comboAfter:outcome.state.attack.combo,
    features:l.features,dead:outcome.state.dead,score:outcome.state.attack.totals.sent+l.value};
}
// Only revealed occupancy and garbage markers matter to the authority probe.
function authorityCheck(template,source,move,outcome){
  assert.equal(source.attack.pending.length,0);
  assert.ok(source.next.length>=1,'Never synthesize an unknown next piece');
  const e=new PlacementArenaEngine({rules:template.rules}),s=e.state;
  s.board={...structuredClone(template.board),lastWasAttack:source.board.lastWasAttack,
    rows:Array.from(source.board.rows,(row,y)=>Array.from({length:10},(_,x)=>!(row&(1<<x))?null:source.board.garbage[y]&(1<<x)?'gb':'i'))};
  s.piece={...source.current};s.hold={...source.hold};s.bag.queue=[...source.next];
  s.frame=source.frame;s.lastClear=source.lastClear;s.garbageLockedUntil=source.garbageLockedUntil;
  s.stats.pieces=source.attack.pieces;
  Object.assign(s.attack,structuredClone(source.attack));
  const action={action:{kind:'place'},move:{piece:move.piece.type,x:move.piece.x,y:Math.ceil(move.piece.y),
    rotation:move.piece.r,useHold:false,cells:cells(move.piece)},execution:{spin:move.piece.spin,moves:move.path}};
  const proof=validatePlacement(visibleState(s),action),lockFrame=source.frame+23;
  while(s.frame<lockFrame)e.step();
  e.beginFrame([]);e.advanceSegment(.5);const actual=commitPlacement(e,proof,lockFrame);e.finishFrame();
  assert.deepEqual(pack(s.board),outcome.state.board,'Authority board parity');
  for(const k of ['btb','combo','pieces','cumulativeSent'])assert.equal(s.attack[k],outcome.state.attack[k],k);
  for(const k of ['generated','cancelled','sent'])assert.equal(s.attack.totals[k],outcome.state.attack.totals[k],k);
  assert.equal(!s.playing,outcome.state.dead,'Authority death parity');
  return {passed:true,actual};
}

export function probeFrontier(audit){
  const snapshot=audit.snapshot,before=JSON.stringify(snapshot),rules=snapshot.rules,root=fromSnapshot(snapshot);
  assert.equal(root.attack.pending.length,1,'This bounded diagnostic requires exactly one known packet');
  assert.equal(root.attack.pending[0].amt,1);
  assert.notEqual(root.attack.pending[0].activeFrame,null,'Unknown activation requires a separate information-set model');
  const hypotheses=scenarios(root,{framesPerPiece:24,horizon:6});assert.equal(hypotheses.length,10);
  const cache=new Map(),branches=[];let authorityChecks=0,geometryStates=0;
  // No hole/scenario label is passed here. Choice depends on revealed state only.
  function extend(revealed){
    assert.equal(revealed.attack.pending.length,0,'Do not peek at an unrevealed future hole');
    assert.ok(revealed.current&&revealed.next.length>=1,'Insufficient known queue');
    const state=clone(revealed);state.frontier=false;
    const key=stateKey(state)+'|'+JSON.stringify(state.attack.totals);
    if(cache.has(key))return cache.get(key);
    const sources=[{state,held:false}],h=holdState(state,rules);if(h&&!h.dead)sources.push({state:h,held:true});
    const evaluated=[];const internal=[];
    for(const {state:source,held} of sources){
      assert.ok(source.next.length>=1);
      const g=moves(source,rules);geometryStates+=g.states;
      for(const move of g.moves){
        const outcome=place(source,move.piece,rules,{framesPerPiece:24,rootFrame:root.frame,
          scenario:{hole:0,unknownDelay:Infinity}}); // No remaining packets: hole cannot affect this step.
        const result=record(source,move,outcome,held);evaluated.push(result);internal.push({source,move,outcome,result});
      }
    }
    assert.ok(evaluated.length,'No legal continuation is not silently treated as proven death');
    internal.sort((a,b)=>b.result.score-a.result.score);
    const best=internal[0];
    const authority=authorityCheck(snapshot,best.source,best.move,best.outcome);authorityChecks++;
    const output={best:best.result,authority,legalPlacements:evaluated.length,
      maximumGenerated:Math.max(...evaluated.map(x=>x.generated)),
      maximumCancelled:Math.max(...evaluated.map(x=>x.cancelled)),
      // Preserve all successors so high-attack alternatives can be audited.
      successors:evaluated};
    cache.set(key,output);return output;
  }
  function branch(label,rootAction,continuation,expectedScore){
    const results=[];
    for(const scenario of hypotheses){
      let state=fromSnapshot(snapshot);
      for(let i=0;i<continuation.length;i++){
        const step=continuation[i];
        if(i===0?rootAction.action.kind==='hold':step.held){state=holdState(state,rules);assert.ok(state&&!state.dead);}
        assert.ok(!state.frontier&&!state.dead,'Pre-reveal prefix must not condition on a prior reveal');
        const g=moves(state,rules);
        const move=g.moves.find(m=>m.piece.type===step.piece&&m.piece.x===step.x&&Math.ceil(m.piece.y)===step.y&&
          m.piece.r===step.rotation&&m.piece.spin===step.spin&&cellKey(cells(m.piece))===cellKey(step.cells));
        assert.ok(move,'Frozen original prefix must remain reachable');
        const out=place(state,move.piece,rules,{framesPerPiece:24,rootFrame:root.frame,scenario});
        const expected=step.immediate[scenario.id];
        close(out.sent,expected.sent,'Prefix sent');
        assert.equal(out.state.attack.btb,expected.after.btb);
        close(leaf(out.state,weights).value,expected.dead?-1e6:
          -expected.features.load-expected.features.coveredEmpty-expected.features.height,'Prefix leaf');
        state=out.state;
      }
      const old=state.attack.totals.sent+leaf(state,weights).value;
      const continuationResult=state.dead?null:extend(state);
      if(!state.dead)assert.equal(state.frontier,true,'Only extend first-reveal frontier leaves');
      results.push({hole:scenario.hole,weight:0.1,baselineScore:old,baselineFeatures:leaf(state,weights).features,
        baselineBtb:state.attack.btb,prefixDepth:continuation.length,knownCurrent:state.current?.type??null,
        knownQueue:[...state.next],score:continuationResult?.best.score??old,extension:continuationResult});
    }
    const baselineScore=mean(results.map(r=>r.baselineScore));close(baselineScore,expectedScore,'Frozen baseline score');
    branches.push({label,rootAction,prefixNodeIds:continuation.map(n=>n.id),baselineScore,
      extendedScore:mean(results.map(r=>r.score)),gain:mean(results.map(r=>r.score-r.baselineScore)),
      generated:mean(results.map(r=>r.extension?.best.generated??0)),
      cancelled:mean(results.map(r=>r.extension?.best.cancelled??0)),
      newlySent:mean(results.map(r=>r.extension?.best.sent??0)),results});
  }
  for(const c of audit.candidates)branch('rank-'+c.rank,c.action,c.continuation,c.totalEvaluation);
  for(const [i,c] of audit.alternatives.C.chosenRootB2BPreserving.entries())
    branch('selected-root-keep-b2b-'+i,audit.candidates[0].action,c.continuation,c.continuation.at(-1).score);
  assert.equal(JSON.stringify(snapshot),before,'PublicSnapshot mutation');
  return {schema:'kiwi-frontier-probe/1',game:audit.game,frame:audit.frame,snapshot,
    snapshotHash:createHash('sha256').update(before).digest('hex'),weights,
    method:'Frozen pre-reveal prefixes; same ten equiprobable hole scenarios; exactly one adaptive placement; no extra future pieces or opponent arrivals; existing ordinary-regime movegen without beam pruning.',
    limitations:['Not a complete re-search of pruned prefixes.','Existing movegen is not exhaustive over every rotation history.',
      'B2B branches can reach frontier at different times; extending each by one does not equalize total depth.',
      'No remaining pending after reveal, therefore additional cancellation must be zero.'],
    authorityChecks,geometryStates,branches};
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const dir='docs/audits/kiwi-frontier-probe';await mkdir(dir,{recursive:true});
  await mkdir('.cache/kiwi-frontier-probe',{recursive:true});
  for(const name of ['g3-f1032','g3-f1056']){
    const input=JSON.parse(await readFile(`docs/audits/kiwi-ft7-35765171232/${name}.json`,'utf8'));
    const result=probeFrontier(input);
    await writeFile(`.cache/kiwi-frontier-probe/${name}-full.json`,JSON.stringify(result));
    const summary={...result,branches:result.branches.map(b=>({...b,results:b.results.map(r=>{
      if(!r.extension)return r;
      const {successors,...extension}=r.extension;
      return {...r,extension:{...extension,positiveAttackPlacements:successors.filter(x=>x.generated>0).length}};
    })}))};
    await writeFile(`${dir}/${name}.json`,JSON.stringify(summary));
    console.log(JSON.stringify({name,authorityChecks:result.authorityChecks,geometryStates:result.geometryStates,
      branches:result.branches.map(({results,rootAction,prefixNodeIds,...b})=>b)}));
  }
}
