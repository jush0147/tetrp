// ROOK's attack projection must use Tetrp's public rules authority, not a
// parallel B2B/Surge/opener formula. Every input below is player-visible.
import {createAttack,resolveAttack} from '../attack.js';
import {createHoles} from '../random.js';

const clonePackets=packets=>(packets??[]).map(p=>({
  amt:p.amt,active:p.active,hardened:p.hardened,shielded:p.shielded,
  status:p.status,activeFrame:p.activeFrame,
}));
const sum=packets=>(packets??[]).reduce((n,p)=>n+p.amt,0);

export function visibleCombat(visible){
  if(!visible.attack)return {live:false,pieces:visible.piecesPlaced??0,combo:0,btb:0,
    multiplier:1,cumulativeSent:0,pending:[],are:[]};
  const a=visible.attack;
  return {live:true,pieces:visible.piecesPlaced,combo:a.combo,btb:a.btb,
    multiplier:a.multiplier,cumulativeSent:a.cumulativeSent,
    pending:clonePackets(a.pending),are:clonePackets(a.are)};
}

// Advance only *publicly knowable* battle-clock changes. This matches the
// order of Engine.finishFrame(): frame increments, public packet wait events
// fire, and THEN the time-based attack multiplier rises. No hidden hole/RNG
// data is read or synthesized.
export function advanceCombatClock(combat,fromFrame,frames,rules){
  if(!Number.isInteger(fromFrame)||fromFrame<0||
    !Number.isInteger(frames)||frames<0)
    throw new RangeError('invalid public battle clock');
  const next={...combat,pending:clonePackets(combat.pending),
    are:clonePackets(combat.are)};
  for(let f=fromFrame+1;f<=fromFrame+frames;f++){
    for(const packet of next.pending){
      if(packet.active===false&&Number.isInteger(packet.activeFrame)&&
        packet.activeFrame===f)packet.active=true;
    }
    if(next.live&&f>rules.garbagemargin_frames+1)
      next.multiplier+=rules.garbageincrease_per_second/60;
  }
  return next;
}

// Engine.tank() is deterministic about *how many* exposed packets can enter.
// The garbage hole is hidden, so predicting board geometry from this alone
// would be an information leak. Consumers must branch or stop such a rollout.
export function forecastPublicTank(combat,blocked,rules){
  if(!combat.live||blocked)return {amount:0,unknownHole:false};
  let room=Math.floor(Math.min(rules.garbagecap,rules.garbagecapmax));
  let amount=0;
  for(const packet of combat.pending){
    if(room<=0)break;
    if(packet.active!==true||packet.status!=='spawn'||packet.shielded)continue;
    const take=Math.min(room,packet.amt);
    if(take>0){amount+=take;room-=take;}
  }
  return {amount,unknownHole:amount>0};
}

export function projectCombat(combat,clear,rules){
  if(!combat.live){
    const next={...combat,pieces:combat.pieces+1};
    return {combat:next,combo:0,btb:0,pending:0,generated:0,
      offensive:0,defensive:0,attack:0,surge:0,blocked:false};
  }
  const state={...createAttack(),pieces:combat.pieces,combo:combat.combo,
    btb:combat.btb,multiplier:combat.multiplier,
    cumulativeSent:combat.cumulativeSent,
    pending:clonePackets(combat.pending),are:clonePackets(combat.are)};
  // Cancellation invokes completePacket() and consumes garbage-hole RNG.
  // The RNG never affects attack totals. Use only a fixed synthetic seed,
  // never the private authority's holes or random generator.
  const events=resolveAttack(state,clear,rules,createHoles(1));
  const phases=[...events.surge,events.normal,events.all_clear].filter(Boolean);
  const total=field=>phases.reduce((n,p)=>n+p[field],0);
  const next={live:true,pieces:state.pieces,combo:state.combo,btb:state.btb,
    multiplier:state.multiplier,cumulativeSent:state.cumulativeSent,
    pending:clonePackets(state.pending),are:clonePackets(state.are)};
  return {combat:next,combo:next.combo,btb:next.btb,
    pending:sum(next.pending)+sum(next.are),
    generated:total('generated'),offensive:total('sent'),
    defensive:total('cancelled'),attack:total('generated'),
    surge:events.surge.reduce((n,p)=>n+p.generated,0),
    blocked:events.blocked};
}
