export class PlaybackClock {
  constructor(){this.frame=0;this.startedAt=null;this.speed=1;}
  position(now){return this.frame+(this.startedAt===null?0:(now-this.startedAt)*.06*this.speed);}
  start(frame,now){this.frame=frame;this.startedAt=now;}
  pause(now){this.frame=this.position(now);this.startedAt=null;return this.frame;}
  setSpeed(speed,now){if(![.5,1,1.5].includes(speed))throw new RangeError('Unsupported speed');
    this.frame=this.position(now);if(this.startedAt!==null)this.startedAt=now;this.speed=speed;}
  target(now,end){return Math.min(end,Math.floor(this.position(now)));}
}
export function displayStats(state){
  const time=(state.frame+state.subframe)/60;
  return {time,pieces:state.stats.pieces,lines:state.stats.lines,score:state.stats.score,
    b2b:state.attack?Math.max(0,state.attack.btb-1):null,combo:state.attack?.combo??null,
    attack:state.attack?.totals.generated??null,sent:state.attack?.totals.sent??null,
    received:state.attack?.totals.received??null,pps:time?state.stats.pieces/time:0,
    apm:state.attack?time?state.attack.totals.generated*60/time:0:null,
    app:state.attack?state.stats.pieces?state.attack.totals.generated/state.stats.pieces:0:null};
}
export function incomingGarbage(state){
  if(!state.attack)return {total:null,cap:null,packets:[]};
  const packets=[...state.attack.are,...state.attack.pending].filter(p=>p.amt>0).map(p=>({
    amount:p.amt,active:Boolean(p.active),id:p.cid,
  }));
  return {total:packets.reduce((sum,p)=>sum+p.amount,0),
    cap:Math.floor(Math.min(state.rules.garbagecap,state.rules.garbagecapmax)),packets};
}
export function visibleGarbage(packets,height,rowHeight=24){
  return packets.slice(0,Math.max(0,Math.floor(height/rowHeight)));
}
export function placementLabel(p){
  if(!p)return '—';
  const spin=p.spin!=='none'?`${p.piece.toUpperCase()}-SPIN${p.spin==='mini'?' MINI':''}`:'';
  const clear=['','SINGLE','DOUBLE','TRIPLE','QUAD'][p.lines]??`${p.lines} LINES`;
  return [p.allClear?'ALL CLEAR':'',spin,clear].filter(Boolean).join(' · ')||'—';
}
