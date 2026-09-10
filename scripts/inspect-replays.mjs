// Explicit paths only. Prints structural counts, never identifiers or raw payloads.
import { readFileSync } from 'node:fs';
import { parseReplay, prepareReplay } from '../src/replay/index.js';
if (process.argv.length < 3) throw new Error('Usage: node scripts/inspect-replays.mjs <private replay paths...>');
for (const path of process.argv.slice(2)) {
  const replay=parseReplay(readFileSync(path,'utf8'));
  let players=0, events=0; const types={}, blockers=new Set();
  for(const round of replay.rounds)for(const player of round.players){
    players++;events+=player.stream.events.length;
    for(const e of player.stream.events){const type=e.type==='ige'?`ige:${e.data.type}`:e.type;types[type]=(types[type]??0)+1;}
    try {prepareReplay(player);} catch(e){if(e.code!=='UNSUPPORTED_PROFILE')throw e;blockers.add(e.message);}
  }
  console.log(JSON.stringify({variant:replay.variant,rounds:replay.rounds.length,players,events,types,blockers:[...blockers]},null,2));
}
