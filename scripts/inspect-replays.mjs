// Explicit paths only. Prints structural counts, never identifiers or raw payloads.
import { readFileSync } from 'node:fs';
import { parseReplay, prepareReplay } from '../src/replay/index.js';

const usage = 'Usage: node scripts/inspect-replays.mjs [--plain] <private replay paths...>';
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(usage);
} else {
  const plain = args.includes('--plain');
  const paths = args.filter(arg => arg !== '--plain');
  if (!paths.length) throw new Error(usage);

  for (const [index, path] of paths.entries()) {
    const replay = parseReplay(readFileSync(path, 'utf8'));
    let players = 0, events = 0;
    const types = {}, blockers = new Set();
    for (const round of replay.rounds) for (const player of round.players) {
      players++;
      events += player.stream.events.length;
      for (const e of player.stream.events) {
        const type = e.type === 'ige' ? `ige:${e.data.type}` : e.type;
        types[type] = (types[type] ?? 0) + 1;
      }
      try {
        prepareReplay(player);
      } catch (e) {
        if (e.code !== 'UNSUPPORTED_PROFILE') throw e;
        blockers.add(e.message);
      }
    }

    const summary = {variant: replay.variant, rounds: replay.rounds.length,
      players, events, types, blockers: [...blockers]};
    if (plain) {
      // Short, predictable lines for terminal screen readers and text-to-speech.
      const eventTypes = Object.entries(types)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, count]) => `${type}: ${count}`).join('; ') || 'none';
      console.log([
        `Replay ${index + 1}`,
        `Variant: ${summary.variant}`,
        `Rounds: ${summary.rounds}`,
        `Player streams: ${summary.players}`,
        `Events: ${summary.events}`,
        `Event types: ${eventTypes}`,
        `Unsupported profiles: ${summary.blockers.length}`,
      ].join('\n'));
    } else {
      console.log(JSON.stringify(summary, null, 2));
    }
  }
}
