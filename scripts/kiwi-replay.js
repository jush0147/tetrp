import {parseReplay,prepareReplay,Reconstruction} from '../src/replay/index.js';

function anchor(s,terminal=false,reason=s.reason){
  const p=s.piece;
  const flags=(p.spin==='none'?0:8|(p.spin==='mini'?16:0))|(p.wall?64:0)|((terminal||p.sleeping)?128:0)|
    (p.forceLock?2048:0)|(p.softDropped?4096:0);
  return {gameoverreason:reason,stats:{lines:s.stats.lines,holds:s.stats.holds,piecesplaced:s.stats.pieces,
    score:s.stats.score,level:s.stats.level,level_lines:s.stats.levelLines,combo:s.attack.combo,btb:s.attack.btb},
    game:{board:structuredClone(s.board.rows),hold:{...s.hold},bag:[...s.bag.queue],g:s.g,playing:terminal?false:s.playing,
      falling:{type:p.type,x:p.x,y:p.y,r:p.r,hy:p.hy,kick:p.kick,keys:p.keys,safelock:p.safelock,locking:p.locking,
        lockresets:p.resets,rotresets:p.rotationResets,flags}}};
}

/** Observer only: never feeds snapshots or hidden state back into either policy.
 * Existing v19 import derives both random streams from seed; fail closed when
 * an arena used independent seeds instead of producing a divergent replay.
 */
export function replayRecorder(names=['Native Kiwi v0','Legacy Kiwi']){
  const players=[],igeIds=[0,0],remoteIds=[0,0];
  const input=(s,frame,key,type,subframe=0)=>s.events.push({frame,type,data:{key,subframe}});
  function ige(s,seat,frame,type,data){s.events.push({frame,type:'ige',data:{id:++igeIds[seat],frame,type,data}});}
  function record(e){
    if(e.type==='initial'){
      if(e.executionModel!=='physical-input-v1')throw new Error('TTRM input export requires physical-input-v1; placement arena needs a separate action replay format');
      if(e.seed!==e.holeSeed)throw new Error('TTRM export requires matching piece/hole seeds; independent-hole arena is unsupported by current replay profile');
      const s={frames:0,options:{version:19,seed:e.seed,gameid:e.seat+1,username:names[e.seat],handling:{...e.state.handling}},
        events:[{frame:0,type:'start',data:{}}]};
      players[e.seat]={id:e.seat===0?'native-kiwi':'legacy-kiwi',username:names[e.seat],replay:s};
      ige(s,e.seat,0,'target',{targets:[2-e.seat]});return;
    }
    const s=players[e.seat].replay;
    if(e.type==='hold'){input(s,e.frame,'hold','keydown');input(s,e.frame,'hold','keyup');}
    if(e.type==='inputs')for(const p of e.inputs)input(s,p.frame,p.key,p.type,p.subframe);
    if(e.type==='receive'){
      const data={type:'garbage',amt:e.event.amt,gameid:2-e.seat,frame:e.frame,cid:++remoteIds[e.seat],iid:e.event.iid,ackiid:e.event.ackiid};
      ige(s,e.seat,e.frame,'interaction',data);
      if(e.cid!==null)ige(s,e.seat,e.frame,'interaction_confirm',{...data});
    }
    if(e.type==='anchor')s.events.push({frame:e.frame,type:'full',data:anchor(e.state)});
    if(e.type==='end'){
      const reason=e.winner===e.seat?'winner':e.state.reason??'unknown',data=anchor(e.state,true,reason);
      s.frames=e.frame;s.results={gameoverreason:reason,stats:data.stats};
      s.events.push({frame:e.frame,type:'end',data});
    }
  }
  function finish(){
    const document={version:1,gamemode:'league',generator:'Tetrp physical-input demonstration (not placement-strength arena or official TETR.IO recording)',replay:{rounds:[players]}};
    const parsed=parseReplay(JSON.stringify(document)),verification=[];
    for(const player of parsed.rounds[0].players){
      const reconstruction=new Reconstruction(prepareReplay(player));reconstruction.run();
      if(reconstruction.diagnostics.first)throw new Error('Export reconstruction diverged: '+JSON.stringify(reconstruction.diagnostics.first));
      verification.push({player:player.username,anchors:reconstruction.diagnostics.observations.length,pieces:reconstruction.state.stats.pieces,divergences:0});
    }
    return {document,verification};
  }
  return {record,finish};
}
