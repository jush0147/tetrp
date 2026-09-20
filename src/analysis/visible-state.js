// Bot-independent, allowlisted projection. Never transport a checkpoint to a bot.
export function visibleState(state) {
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
    garbageLockedUntil:state.garbageLockedUntil,
  });
}
