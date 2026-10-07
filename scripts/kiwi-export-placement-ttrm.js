import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {cells} from '../src/board.js';
import {parseReplay} from '../src/replay/parser.js';
import {ViewerSession,catalog,MAX_FILE_BYTES} from '../viewer/session.js';

const source=process.argv[2]??'.cache/observation-result-37616553558';
const out=process.argv[3]??'artifacts/aligned-vs-tetrp-2-7.ttrm';
const result=JSON.parse(await readFile(`${source}/result.json`));assert.equal(result.complete,true);
const document={version:1,gamemode:'league',generator:'Tetrp placement observation: recorded authority outcomes, movement omitted',replay:{rounds:[]}};
const sorted=c=>c.map(p=>p.join(',')).sort();
let locks=0;
function data(s,phase,placement){
 let topEmptyRows=0;while(topEmptyRows<20&&s.board.rows[topEmptyRows].every(c=>c===null))topEmptyRows++;
 const p=s.piece,flags=(p.spin==='none'?0:8|(p.spin==='mini'?16:0))|(p.wall?64:0)|(p.sleeping?128:0);
 const {combo,btb,cumulativeSent,multiplier,totals,pending,are}=s.attack;
 const packet=p=>Object.fromEntries(['amt','active','hardened','shielded','status','activeFrame'].map(k=>[k,p[k]]));
 return {gameoverreason:s.reason,stats:{lines:s.stats.lines,holds:s.stats.holds,piecesplaced:s.stats.pieces,
  score:s.stats.score,level:s.stats.level,level_lines:s.stats.levelLines,combo,btb},
  game:{board:s.board.rows.slice(topEmptyRows),hold:s.hold,bag:s.bag.queue.slice(0,5),g:s.g,playing:s.playing,
   falling:{type:p.type,x:p.x,y:p.y,r:p.r,hy:p.hy,kick:p.kick,keys:p.keys,safelock:p.safelock,locking:p.locking,
    lockresets:p.resets,rotresets:p.rotationResets,flags}},
  tetrp:{phase,topEmptyRows,placement,attack:{combo,btb,cumulativeSent,multiplier,totals,pending:pending.map(packet),are:are.map(packet)}}};
}
for(const g of result.games){
 assert.equal(g.reason,'topout');assert.ok(g.failures.every(f=>!f));
 const raw=(await readFile(`${source}/round-${g.round}-events.jsonl`,'utf8')).trim().split('\n').map(JSON.parse);
 const players=[],state=[],request=[],last=[];
 for(const e of raw){
  const seat=e.seat;
  if(e.type==='initial'){
   const policy=g.swapped?1-seat:seat,name=policy===0?'對齊版 Kiwi':'Tetrp 內建 Kiwi';state[seat]=e.state;
   players[seat]={id:policy===0?'aligned':'vendored',username:name,replay:{frames:g.frames,
    options:{version:19,seed:e.seed,handling:e.state.handling},tetrp:{format:'placement-recording/1',rules:e.state.rules},
    events:[{frame:0,type:'start',data:{}},{frame:0,type:'full',data:data(e.state,'initial',null)}]}};
  }
  if(e.type==='decision'&&e.selected.action.kind==='place')request[seat]=e;
  if(e.type==='parity'&&e.kind==='hold')state[seat].stats.holds++;
  if(e.type==='parity'&&e.kind==='placement'){
   const q=request[seat];assert.ok(q);assert.deepEqual(q.selected,e.intent);assert.equal(e.frame,q.frame+23);
   const lock=e.actual.locks[0];assert.deepEqual(sorted(lock.cells),sorted(e.intent.move.cells));
   assert.equal(lock.spin,e.intent.execution.spin);assert.deepEqual(e.actual.clear,q.validated.clear);
   const s=structuredClone(state[seat]),v=q.snapshot;
   s.board=v.board;s.hold=v.hold;s.bag.queue=v.next;s.attack={...s.attack,...v.attack};
   s.piece={...v.current,type:lock.piece,x:lock.x,y:lock.y,r:lock.rotation,spin:lock.spin,sleeping:false};
   assert.deepEqual(sorted(cells(s.piece).map(([x,y])=>[x,Math.ceil(y)])),sorted(lock.cells));
   const placement={piece:lock.piece,spin:lock.spin,index:s.stats.pieces+1,frame:e.frame,subframe:.5,
    lines:e.actual.clear.lines,allClear:e.actual.clear.allClear,sent:null};
   last[seat]=placement;
   // Show the submitted landing during the second half of its 24-frame slot.
   // This is presentation timing, not a fabricated keyboard movement sequence.
   players[seat].replay.events.push({frame:q.frame+12,type:'full',data:data(s,'landing',placement)});locks++;
  }
  if(e.type==='anchor'){
   if(last[seat])last[seat]={...last[seat],sent:e.state.attack.totals.sent-state[seat].attack.totals.sent};
   state[seat]=e.state;players[seat].replay.events.push({frame:e.frame,type:'full',data:data(e.state,'result',last[seat])});
  }
  if(e.type==='end'){
   const s=structuredClone(e.state);s.reason=e.winner===seat?'winner':s.reason;s.playing=false;
   const d=data(s,'end',last[seat]);players[seat].replay.results={gameoverreason:s.reason,stats:d.stats};
   players[seat].replay.events.push({frame:e.frame,type:'end',data:d});
  }
 }
 document.replay.rounds.push(g.swapped?players.reverse():players);
}
const text=JSON.stringify(document);assert.ok(Buffer.byteLength(text)<MAX_FILE_BYTES,`File exceeds viewer limit: ${Buffer.byteLength(text)}`);
const replay=parseReplay(text),verification=[];
for(const round of replay.rounds)for(const player of round.players){
 const session=new ViewerSession(replay,round.index,player.index);await session.initialize();
 const raw=player.stream.events.filter(e=>e.type==='full'||e.type==='end');
 for(const e of raw){const view=session.result();assert.deepEqual(view.state.board.rows.slice(e.data.tetrp.topEmptyRows),e.data.game.board);
  assert.deepEqual(view.state.bag.queue,e.data.game.bag);assert.deepEqual(view.state.hold,e.data.game.hold);
  assert.equal(view.state.stats.pieces,e.data.stats.piecesplaced);session.step(1);}
 verification.push({round:round.index+1,name:player.username,points:raw.length,placements:session.total});
}
assert.equal(locks,result.games.reduce((n,g)=>n+g.parity.reduce((n,p)=>n+p.placements,0),0));
const scores=catalog(replay).at(-1).players.map(p=>p.scoreAfter);assert.deepEqual(scores,result.score);
await mkdir(out.slice(0,out.lastIndexOf('/')),{recursive:true});await writeFile(out,text);
await writeFile(out+'.audit.json',JSON.stringify({source,locks,bytes:Buffer.byteLength(text),scores,verification},null,2));
console.log(JSON.stringify({out,locks,bytes:Buffer.byteLength(text),scores,streams:verification.length}));
