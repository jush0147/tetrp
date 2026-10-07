import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {parseReplay} from '../src/replay/parser.js';
import {ViewerSession,catalog,MAX_FILE_BYTES} from '../viewer/session.js';
import {RECORDING_FORMAT,stateDigest} from '../viewer/placement-recording.js';

const source=process.argv[2]??'.cache/observation-result-37616553558';
const out=process.argv[3]??'artifacts/aligned-vs-tetrp-2-7-verified.ttrm';
const result=JSON.parse(await readFile(source+'/result.json'));assert.equal(result.complete,true);
const document={version:1,gamemode:'league',generator:'Tetrp authority placement recording; requires authority-placement/1 import support; not an official TETR.IO input replay',replay:{rounds:[]}};
const action=a=>({candidateIndex:a.candidateIndex,action:a.action,move:a.move,execution:a.execution});
for(const g of result.games){
  assert.equal(g.reason,'topout');assert.ok(g.failures.every(f=>!f));
  const raw=(await readFile(source+'/round-'+g.round+'-events.jsonl','utf8')).trim().split('\n').map(JSON.parse);
  const players=[];
  for(const e of raw){
    const seat=e.seat;
    if(e.type==='initial'){
      assert.equal(e.executionModel,'tl-placement-v1');
      const policy=g.swapped?1-seat:seat,name=policy===0?'對齊版 Kiwi':'Tetrp 內建 Kiwi';
      players[seat]={id:policy===0?'aligned':'vendored',username:name,replay:{frames:g.frames,
        options:{version:19,seed:e.seed,handling:e.state.handling},
        tetrp:{format:RECORDING_FORMAT,holeSeed:e.holeSeed,cadence:24,rules:e.state.rules,ops:[]},
        events:[{frame:0,type:'start',data:{}}]}};
    }
    const s=players[seat]?.replay;if(!s)continue;
    const ops=s.tetrp.ops;
    if(e.type==='initial'||e.type==='anchor')ops.push({type:'check',frame:e.frame??0,hash:await stateDigest(e.state)});
    if(e.type==='receive')ops.push({type:'receive',frame:e.frame,cid:e.cid,
      data:{from:'P2',to:'P1',iid:e.event.iid,ackiid:e.event.ackiid,amt:e.event.amt}});
    if(e.type==='decision'&&e.selected.action.kind==='place'){
      assert.equal(e.selected.candidateIndex,0);ops.push({type:'plan',frame:e.frame,action:action(e.selected)});
    }
    if(e.type==='parity'&&e.kind==='hold')ops.push({type:'hold',frame:e.frame,action:action(e.intent),expected:e.actual});
    if(e.type==='parity'&&e.kind==='placement')ops.push({type:'lock',frame:e.frame,expected:e.actual});
    if(e.type==='end'){
      const reason=e.winner===seat?'winner':e.state.reason;
      ops.push({type:'end',frame:e.frame,hash:await stateDigest(e.state),reason});
      s.results={gameoverreason:reason,stats:{piecesplaced:e.state.stats.pieces,lines:e.state.stats.lines,holds:e.state.stats.holds}};
      s.events.push({frame:e.frame,type:'end',data:{gameoverreason:reason}});
    }
  }
  document.replay.rounds.push(g.swapped?players.reverse():players);
}
const text=JSON.stringify(document);assert.ok(Buffer.byteLength(text)<MAX_FILE_BYTES);
const parsed=parseReplay(text),verification=[];
for(const round of parsed.rounds)for(const player of round.players){
  const session=new ViewerSession(parsed,round.index,player.index);
  await session.initialize({yieldTask:async()=>{}});
  assert.equal(session.total,player.stream.results.stats.piecesplaced);
  session.seek('frame',session.frames);assert.equal(session.state.reason,player.stream.results.gameoverreason);
  verification.push({round:round.index+1,name:player.username,...session.conformance});
  console.log(JSON.stringify(verification.at(-1)));
}
assert.deepEqual(catalog(parsed).at(-1).players.map(p=>p.scoreAfter),result.score);
const locks=verification.reduce((n,v)=>n+v.placements,0);
assert.equal(locks,result.games.reduce((n,g)=>n+g.parity.reduce((n,p)=>n+p.placements,0),0));
await mkdir(dirname(out),{recursive:true});await writeFile(out,text);
await writeFile(out+'.audit.json',JSON.stringify({source,locks,bytes:Buffer.byteLength(text),score:result.score,verification},null,2));
console.log(JSON.stringify({out,locks,bytes:Buffer.byteLength(text),score:result.score}));
