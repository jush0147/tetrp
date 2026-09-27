import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {Engine} from '../src/engine.js';
import * as B from '../src/board.js';
import * as R from '../src/rotation.js';
import {PlacementArenaEngine,commitHold} from '../src/analysis/placement-authority.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {createPlacementTools} from '../vendor/kiwi-v1/tetrp-placement-path.mjs';
import {captureSnapshotFromEngine,buildSnapshotRequest} from '../vendor/kiwi-v1/kiwi-snapshot-adapter.mjs';
const [mode,dir='.cache/cc2-snapshot-hold-results',binary]=process.argv.slice(2);
const tools=createPlacementTools({Engine,boardModule:B,rotationModule:R});
const request=e=>buildSnapshotRequest(captureSnapshotFromEngine(e,tools),{nodeBudget:2000,framesPerPiece:24});
if(mode==='install'){
  const file=`${dir}/src/snapshot.rs`,s=await readFile(file,'utf8');assert.ok(!s.includes('audit_snapshot_hold'));
  await writeFile(file,s+'\n'+await readFile('tools/cc2-transition-audit/snapshot-hold-probe.rs','utf8'));
}else if(mode==='prepare'){
  const cases=[],pairs=[];
  const specs=[];
  for(const hold of [null,'t','i'])for(const next of ['t','o'])specs.push({hold,next,current:'t',clear:false,obstructed:false});
  for(const clear of [false,true])specs.push({hold:'i',next:'t',current:'o',clear,obstructed:true});
  for(const [index,spec]of specs.entries()){
    const pair=[];
    for(const hidden of ['z','l']){
      const e=new PlacementArenaEngine(),s=e.state;
      if(spec.obstructed)s.board.rows[18][3]='j';
      s.lastClear=spec.clear;s.attack.combo=spec.clear?1:0;e.spawn(spec.current);
      s.hold={piece:spec.hold,locked:false};s.bag.queue=[spec.next,'s','j','o','i',hidden,'t'];
      const before=visibleState(s),req=request(e),mode=spec.hold===null?'empty':'occupied';
      const action={action:{kind:'hold',mode,samePiece:(spec.hold??spec.next)===spec.current,requiresReanalysis:true}};
      const actual=commitHold(e,before,action);
      const known=mode==='empty'?4:5;
      const expectedPost={queue:[actual.current.type,...actual.next.slice(0,known)].map(p=>p.toUpperCase()),
        hold:actual.hold.piece.toUpperCase(),knownLength:known+1,samePiece:action.action.samePiece};
      const id=`${index}/${hidden}/before`;pair.push(id);
      cases.push({id,request:req,expected:{post:expectedPost,holdAction:{kind:'hold',mode,same_piece:action.action.samePiece,requires_reanalysis:true}},
        authority:{before,after:visibleState(s),actual}});
      if(s.playing){
        const nextRequest=request(e);assert.equal(nextRequest.hold_locked,true);
        assert.equal(nextRequest.start.queue.length,6);
        cases.push({id:`${index}/${hidden}/after`,request:nextRequest,expected:{post:null,holdAction:null}});
      }else assert.equal(spec.obstructed,true);
    }
    const a=cases.find(c=>c.id===pair[0]),b=cases.find(c=>c.id===pair[1]);
    assert.deepEqual(a.request,b.request,'hidden tail must not enter request');
    assert.deepEqual(a.expected,b.expected,'hypothetical Hold must retain only known prefix');pairs.push(pair);
    const afterA=cases.find(c=>c.id===`${index}/z/after`),afterB=cases.find(c=>c.id===`${index}/l/after`);
    if(afterA&&spec.hold===null)assert.notDeepEqual(afterA.request.start.queue,afterB.request.start.queue,'empty Hold must reveal new fifth preview');
    if(afterA&&spec.hold!==null)assert.deepEqual(afterA.request,afterB.request,'occupied Hold must not reveal tail');
  }
  await mkdir(dir,{recursive:true});await writeFile(`${dir}/cases.json`,JSON.stringify(cases));
  await writeFile(`${dir}/pairs.json`,JSON.stringify(pairs));
  await writeFile(`${dir}/input.jsonl`,cases.map(({id,request})=>JSON.stringify({id,request})).join('\n')+'\n');
  console.log(JSON.stringify({requests:cases.length,pairs:pairs.length,authorityHolds:specs.length*2}));
}else if(mode==='compare'){
  const cases=JSON.parse(await readFile(`${dir}/cases.json`));
  const run=spawnSync(resolve(binary),[],{input:await readFile(`${dir}/input.jsonl`),encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});
  await writeFile(`${dir}/rust-output.jsonl`,run.stdout??'');await writeFile(`${dir}/rust-stderr.log`,run.stderr??'');
  if(run.error)throw run.error;assert.equal(run.status,0,run.stderr);
  const rows=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows.length,cases.length);
  const failures=[];
  cases.forEach((c,i)=>{const r=rows[i];try{assert.equal(r.id,c.id);assert.ok(!r.error,r.error);
    assert.deepEqual(r.result.holds,c.expected.holdAction?[c.expected.holdAction]:[]);
    if(c.expected.post){const {basis,...post}=r.result.post;assert.deepEqual(post,c.expected.post);assert.ok(basis);}else assert.equal(r.result.post,null);
  }catch(e){failures.push({id:c.id,error:e.message,expected:c.expected,actual:r});}});
  const pairs=JSON.parse(await readFile(`${dir}/pairs.json`));
  for(const [a,b]of pairs)assert.deepEqual(rows.find(r=>r.id===a).result,rows.find(r=>r.id===b).result);
  await writeFile(`${dir}/failures.json`,JSON.stringify(failures));
  const summary={status:failures.length?'snapshot-hold-failed':'snapshot-hold-passed',checks:cases.length,mismatches:failures.length,hiddenTailPairs:pairs.length,
    note:'Real snapshot parser/post_hold_root/analyze_text and authority Hold/reanalysis boundary; no strength or full rules certification.'};
  await writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));assert.equal(failures.length,0);
}else throw Error('prepare | compare | install');
