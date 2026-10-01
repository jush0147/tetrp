import test from 'node:test';
import assert from 'node:assert/strict';
import {match} from '../scripts/kiwi-arena-core.js';
import {PlacementArenaEngine,placementIdentity} from '../src/analysis/placement-authority.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function drop(s){const e=new PlacementArenaEngine({rules:s.rules});e.state.board=structuredClone(s.board);e.state.piece=structuredClone(s.current);e.slam(true);const {spin,...move}=placementIdentity(e.state.piece);return {candidateIndex:0,action:{kind:'place'},move:{...move,useHold:false},execution:{moves:['hardDrop'],spin}};}
const deterministic=r=>{const {latencies,...rest}=r;return rest;};
test('parallel Hold/reanalysis overlaps but frame, ordered events and results equal serial',async()=>{
 const runs=[];
 for(const parallelDecisions of [false,true]){
  const events=[];let active=0,peak=0;
  const bots=[0,1].map(seat=>async s=>{active++;peak=Math.max(peak,active);await wait(seat?1:8);active--;
   if(s.frame===0&&!s.hold.locked)return {candidateIndex:0,action:{kind:'hold',mode:'empty',requiresReanalysis:true,samePiece:s.next[0]===s.current.type}};
   return drop(s);
  });
  const result=await match(bots,{parallelDecisions,seeds:[17,17],maxFrames:48,record:e=>events.push(e)});
  assert.ok(result.failures.every(x=>x===null));assert.deepEqual(result.holds,[1,1]);assert.equal(peak,parallelDecisions?2:1);
  assert.ok(events.filter(e=>e.type==='parity'&&e.kind==='hold').every(e=>e.frame===0));
  assert.deepEqual(events.filter(e=>e.type==='parity'&&e.kind==='placement').map(e=>[e.seat,e.actual.locks[0].frame,e.actual.locks[0].subframe]),[[0,23,.5],[1,23,.5],[0,47,.5],[1,47,.5]]);
  runs.push({result:deterministic(result),events});
 }assert.deepEqual(runs[0],runs[1]);
});
test('asymmetric response delays cannot change same-frame attack/cancellation/delivery transactions',async()=>{
 const states=[0,1].map(()=>{const e=new PlacementArenaEngine();e.spawn('o');for(const y of [38,39])e.state.board.rows[y]=Array.from({length:10},(_,x)=>x===4||x===5?null:'gb');e.state.board.rows[37][0]='j';return structuredClone(e.state);});
 const runs=[];
 for(const parallelDecisions of [false,true]){
  const events=[],result=await match([0,1].map(seat=>async s=>{await wait(seat?1:8);return drop(s);}),{parallelDecisions,startCheckpoint:{states},maxFrames:48,record:e=>events.push(e)});
  assert.ok(result.failures.every(x=>x===null));assert.ok(result.sent.every(x=>x>0));
  const receives=events.filter(e=>e.type==='receive');assert.ok(receives.length>=2);assert.ok(receives.every(e=>e.frame===24));
  runs.push({result:deterministic(result),events});
 }assert.deepEqual(runs[0],runs[1]);
});
test('one failing policy joins the other without placement, fallback or game-clock advance',async()=>{
 let finished=false;
 const r=await match([async()=>{throw Error('fixture failure');},async s=>{await wait(5);finished=true;return drop(s);} ],{parallelDecisions:true,maxFrames:24});
 assert.equal(finished,true);assert.equal(r.frames,0);assert.equal(r.winner,null);assert.equal(r.reason,'policy-or-transport-failure');assert.deepEqual(r.parity.map(p=>p.placements),[0,0]);assert.ok(r.transportStats.every(s=>s.fallbackRequests===0));assert.ok(r.failures[0].snapshot);
});
