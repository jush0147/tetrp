import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fromPublic,dropAction,addPressure,inputFor,authority,differences} from './kiwi-cc2-transition-audit.js';
import {visibleState} from '../src/analysis/visible-state.js';
import {commitHold,validatePlacement} from '../src/analysis/placement-authority.js';
import {convert} from './kiwi-cc2-rotation-audit.js';
const [mode,dir='.cache/cc2-trace-results',binary]=process.argv.slice(2);
if(mode==='prepare'){
 const source=JSON.parse(await readFile('.cache/cc2-transition-results/cases.json'));
 const ids=['empty/plain','empty/inactive-head','empty/activation-24-hole-4','quad/charged-combo','quad/late-clock','full-spin-single/charged-base3'];
 const cases=[];
 for(const id of ids)for(const empty of [false,true])for(const useHold of [false,true]){
  const base=source.find(c=>c.id===id);assert.ok(base,id);const e=fromPublic(base.snapshot),s=e.state;
  s.phase='ready';if(empty)s.hold={piece:null,locked:false};
  addPressure(e,base.input.incoming,base.input.scenario);
  const initial=visibleState(s),traceId=`${id}/empty${empty}/hold${useHold}`,steps=[];let consumed=0;
  for(let i=0;i<4&&s.playing;i++){
   const hold=useHold&&i===1;
   if(hold){const before=visibleState(s);commitHold(e,before,{action:{kind:'hold',mode:s.hold.piece===null?'empty':'occupied',
    samePiece:(s.hold.piece??before.next[0])===s.piece.type,requiresReanalysis:true}});if(empty)consumed++;}
   assert.ok(s.playing,'unexpected Hold topout in trace corpus');
   const action=i===0?base.action:dropAction(e);
   // Certificate supplies the exact final authority pose; no physical transport.
   const proof=validatePlacement(visibleState(s),action);
   const placement={location:convert(proof.finalPiece),spin:proof.finalPiece.spin};
   const previous={...s.attack.totals},expected=authority(e,action);consumed++;
   for(const k of ['generated','cancelled','sent','tanked'])expected.totals[k]-=previous[k];
   expected.elapsed+=24*i;expected.pending.forEach(p=>p.ready+=24*i);
   const knownRemaining=5-consumed;assert.ok(knownRemaining>=0,'trace must stop before private queue tail');
   steps.push({placement,use_hold:hold,expected,action,knownPieces:{current:s.piece.type.toUpperCase(),hold:s.hold.piece?.toUpperCase()??null,
     next:s.bag.queue.slice(0,knownRemaining).map(p=>p.toUpperCase())}});
  }
  assert.equal(steps.length,4);
  cases.push({id:traceId,initial,steps,input:{...inputFor(traceId,initial,steps[0].placement,base.input.scenario),steps:steps.map(({placement,use_hold})=>({placement,use_hold}))}});
 }
 await mkdir(dir,{recursive:true});await writeFile(`${dir}/cases.json`,JSON.stringify(cases));
 await writeFile(`${dir}/input.jsonl`,cases.map(c=>JSON.stringify(c.input)).join('\n')+'\n');
 console.log(JSON.stringify({traces:cases.length,placements:cases.reduce((n,c)=>n+c.steps.length,0)}));
}else if(mode==='compare'){
 const cases=JSON.parse(await readFile(`${dir}/cases.json`));const run=spawnSync(resolve(binary),[],{input:await readFile(`${dir}/input.jsonl`),encoding:'utf8',maxBuffer:64*1024*1024,timeout:120000});
 await writeFile(`${dir}/rust-output.jsonl`,run.stdout??'');await writeFile(`${dir}/rust-stderr.log`,run.stderr??'');if(run.error)throw run.error;assert.equal(run.status,0,run.stderr);
 const rows=run.stdout.trim().split('\n').map(JSON.parse);assert.equal(rows.length,cases.length);const comparisons=[];
 let recorded=0,replayed=0,maxDepth=0;
 for(let i=0;i<cases.length;i++){const c=cases[i],r=rows[i];assert.equal(r.id,c.id);assert.ok(!r.error,r.error);assert.equal(r.steps.length,c.steps.length);
  recorded+=r.dag[0];replayed+=r.dag[1];maxDepth=Math.max(maxDepth,r.maxDepth);
  r.steps.forEach((x,j)=>{const id=`${c.id}/${j}`;const diff=differences({id,expected:c.steps[j].expected},{...x,id});
   try{assert.deepEqual(x.pieces,c.steps[j].knownPieces);}catch{diff.fields.push('knownPieces');}comparisons.push(diff);});
 }
 const summary={status:'multi-placement-diagnostic-completed',checks:comparisons.length,mismatches:comparisons.filter(c=>c.fields.length).length,
  traces:cases.length,recordedEdges:recorded,replayedEdges:replayed,maxDepth,note:'Four-placement finite public-prefix transcripts and real DAG replay assertions. Not browser or strength certification.'};
 await writeFile(`${dir}/comparisons.json`,JSON.stringify(comparisons));await writeFile(`${dir}/summary.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 assert.ok(recorded>0&&replayed>0&&maxDepth>=2);assert.equal(summary.mismatches,0);
}else throw Error('prepare | compare');
