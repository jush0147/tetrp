// Bot-independent, allowlisted projection. Never transport a checkpoint to a bot.
export function visibleState(state, observedDraws) {
  const packet = p => Object.fromEntries(['amt','active','hardened','shielded','status','activeFrame'].map(k=>[k,p[k]]));
  return structuredClone({
    board: state.board, current: state.piece, hold: state.hold,
    next: state.bag.queue.slice(0,5), rules: state.rules,
    frame: state.frame, subframe: state.subframe, playing: state.playing,
    piecesPlaced: state.stats.pieces,
    attack: state.attack ? {
      combo:state.attack.combo, btb:state.attack.btb,
      cumulativeSent:state.attack.cumulativeSent, multiplier:state.attack.multiplier,
      are:state.attack.are.map(packet), pending:state.attack.pending.map(packet),
    } : null,
    observedDraws,
  });
}

// Track actual draw reveals, not current-piece changes (a nonempty Hold swaps
// current without drawing). Only the visible preview suffix is ever inspected.
export class ObservedDraws {
  constructor(state) {
    this.draws=[state.piece.type,...state.bag.queue.slice(0,5)];
    this.next=state.bag.queue.slice(0,5);
  }
  advance(before, after, transitions) {
    const spawns=transitions.filter(e=>e.type==='spawn').length;
    const holds=transitions.filter(e=>e.type==='hold').length;
    const replacements=holds-(holds>0&&before.hold.piece===null?1:0);
    const count=spawns-replacements;
    const next=after.bag.queue.slice(0,5);
    if(count<0||count>5||JSON.stringify(this.next.slice(count))!==JSON.stringify(next.slice(0,5-count)))
      throw new Error('Cannot align observed preview history');
    if(count)this.draws.push(...next.slice(5-count));
    this.next=next;
  }
}
