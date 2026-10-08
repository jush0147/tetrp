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

export function projectCombat(combat,clear,rules){
  if(!combat.live){
    const next={...combat,pieces:combat.pieces+1};
    return {combat:next,combo:0,btb:0,pending:0,generated:0,
      offensive:0,defensive:0,attack:0,surge:0};
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
    surge:events.surge.reduce((n,p)=>n+p.generated,0)};
}
