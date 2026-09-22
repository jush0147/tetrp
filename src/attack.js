import { completePacket, nextHole } from './random.js';

export function createAttack() {
  return { combo: 0, btb: 0, pieces: 0, multiplier: 1, pending: [], are: [],
    cumulativeSent: 0, iid: 0, cid: 0, incoming: {}, outgoing: {}, outbox: [],
    totals: { generated: 0, cancelled: 0, sent: 0, tanked: 0, received: 0 } };
}
export function baseAttack(lines, spin) {
  if (!Number.isInteger(lines) || lines < 0 || !['none', 'mini', 'full'].includes(spin)) throw new TypeError('Invalid clear');
  return spin === 'full' ? ([0, 2, 4, 6, 10, 12][lines] ?? 12 + 2 * (lines - 5)) : ([0, 0, 1, 2, 4, 5][lines] ?? lines);
}
export function send(s, amount, player = 'P1', target = 'P2') {
  if (amount <= 0) return;
  s.totals.sent += amount; s.cumulativeSent += amount;
  const iid = ++s.iid;
  (s.outgoing[target] ??= []).push({ iid, amt: amount });
  s.outbox.push({ type: 'garbage', from: player, to: target, iid, ackiid: s.incoming[target] ?? 0, amt: amount });
}
export function receive(s, event) {
  if (typeof event.from !== 'string' || !Number.isInteger(event.iid) || event.iid < 0 || !Number.isInteger(event.amt) || event.amt < 0) throw new TypeError('Invalid interaction');
  const peer = event.from, ack = event.ackiid ?? 0;
  let amount = event.amt;
  s.incoming[peer] = Math.max(s.incoming[peer] ?? 0, event.iid);
  s.outgoing[peer] = (s.outgoing[peer] ?? []).filter(record => {
    if (record.iid <= ack) return false;
    const use = Math.min(record.amt, amount); amount -= use; record.amt -= use;
    return record.amt > 0;
  });
  if (!amount) return null;
  const cid = ++s.cid;
  s.pending.push({ cid, sender: peer, iid: event.iid, ackiid: ack, amt: amount, active: false,
    hardened: false, shielded: false, column: null, status: 'spawn', confirmFrame: null, activeFrame: null });
  return cid;
}
// Effects keep private RNG and peer ledgers outside the shared rule transaction.
// Engine callers use the original defaults; search supplies local bookkeeping.
const defaultEffects = { completePacket, send };
export function fight(s, amount, rules, holes, player = 'P1', target = 'P2', effects = defaultEffects) {
  const result = { generated: amount, cancelled: 0, sent: 0, unused_defense_budget: 0 };
  s.totals.generated += amount;
  let attack = amount;
  let defense = s.pieces <= rules.openerphase_pieces && pendingCount(s) >= s.cumulativeSent ? amount : 0;
  for (const queue of [s.are, s.pending]) {
    for (let i = 0; i < queue.length && attack + defense > 0;) {
      const packet = queue[i];
      if (packet.hardened) { i++; continue; }
      const real = Math.min(attack, packet.amt); attack -= real; packet.amt -= real;
      const extra = Math.min(defense, packet.amt); defense -= extra; packet.amt -= extra;
      result.cancelled += real + extra;
      if (packet.amt === 0) {
        queue.splice(i, 1);
        if (queue === s.pending) effects.completePacket(holes, rules.boardwidth);
      } else i++;
    }
  }
  result.sent = attack; result.unused_defense_budget = defense;
  s.totals.cancelled += result.cancelled;
  effects.send(s, attack, player, target);
  return result;
}
export const pendingCount = s => s.pending.reduce((sum, packet) => sum + packet.amt, 0);
export function resolveAttack(s, { lines, spin, allClear, garbageRows }, rules, holes, emit = () => {}, effects = defaultEffects) {
  s.pieces++;
  s.combo = lines ? s.combo + 1 : 0;
  const contribution = (allClear ? rules.allclear_b2b : 0) + (lines >= 4 || lines > 0 && spin !== 'none' ? 1 : 0);
  const resolve = (n, phase) => {
    emit(phase);
    if (rules.garbageblocking === 'none') {
      s.totals.generated += n; effects.send(s, n);
      return { generated: n, cancelled: 0, sent: n, unused_defense_budget: 0 };
    }
    return fight(s, n, rules, holes, 'P1', 'P2', effects);
  };
  const surge = [];
  if (contribution) s.btb += contribution;
  else if (lines) {
    if (rules.b2bcharging && s.btb > rules.b2bcharge_at) {
      const total = Math.floor((s.btb - rules.b2bcharge_at + rules.b2bcharge_base) * s.multiplier);
      const q = Math.round(total / 3);
      for (const n of [q, q, total - 2 * q]) if (n) surge.push(resolve(n, 'surge'));
    }
    s.btb = 0;
  }
  let raw = baseAttack(lines, spin);
  const bonus = (lines || contribution) && s.btb > 1 && !(allClear && contribution === rules.allclear_b2b);
  if (bonus) {
    if (rules.b2bchaining) {
      const log = Math.log1p((s.btb - 1) * 0.8);
      raw += Math.floor(1 + log) + (s.btb === 2 ? 0 : (1 + log % 1) / 3);
    } else raw++;
  }
  if (s.combo > 1) {
    raw *= 1 + 0.25 * (s.combo - 1);
    if (s.combo > 2) raw = Math.max(raw, Math.log1p(1.25 * (s.combo - 1)));
  }
  let amount = Math.floor(raw * s.multiplier);
  if (rules.garbagespecialbonus && garbageRows > 0 && (lines === 4 || spin !== 'none')) amount++;
  if (rules.garbageattackcap > 0) amount = Math.min(amount, rules.garbageattackcap);
  const normal = lines || amount ? resolve(amount, 'ordinary') : { generated: 0, cancelled: 0, sent: 0, unused_defense_budget: 0 };
  const ac = allClear && rules.allclears ? resolve(Math.floor(rules.allclear_garbage * s.multiplier), 'all-clear') : null;
  return { surge, normal, all_clear: ac, blocked: rules.garbageblocking === 'combo blocking' && Boolean(lines || amount), b2bBonus: Boolean(bonus) };
}
export function tank(s, rules, holes, insert = () => true) {
  const cap = Math.floor(Math.min(rules.garbagecap, rules.garbagecapmax));
  let count = 0;
  for (let i = 0; i < s.pending.length && count < cap;) {
    const packet = s.pending[i];
    if (!packet.active || packet.status !== 'spawn' || packet.shielded) { i++; continue; }
    const hole = nextHole(holes, rules.boardwidth, packet.column);
    if (!insert(hole)) break;
    packet.amt--; count++;
    if (packet.amt === 0) { s.pending.splice(i, 1); completePacket(holes, rules.boardwidth); }
  }
  s.totals.tanked += count;
  return count;
}
