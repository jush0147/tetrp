import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttack, resolveAttack, fight, tank, receive, send, pendingCount } from '../src/attack.js';
import { createHoles } from '../src/random.js';
import { ruleset } from '../src/rules.js';
const r = ruleset();
const pending = (s, amt, extra = {}) => s.pending.push({ cid: ++s.cid, amt, active: true, status: 'spawn', column: null, hardened: false, ...extra });
test('zero-attack single blocks tank; no-clear tanks cap eight', () => {
  const s = createAttack(), h = createHoles(1); pending(s, 12);
  assert.equal(resolveAttack(s, { lines: 1, spin: 'none' }, r, h).blocked, true);
  assert.equal(pendingCount(s), 12);
  assert.equal(resolveAttack(s, { lines: 0, spin: 'none' }, r, h).blocked, false);
  assert.equal(tank(s, r, h), 8); assert.equal(pendingCount(s), 4);
});
test('opener budget is defense only and includes inactive packets', () => {
  for (const [amount, cancelled, sent] of [[2,2,2],[6,6,0],[12,8,0]]) {
    const s = createAttack(), h = createHoles(1); pending(s, amount, { active: false });
    const result = fight(s, 4, r, h);
    assert.equal(result.cancelled, cancelled); assert.equal(result.sent, sent);
  }
});
test('ARE queue cancellation precedes pending; hardened skips cancellation but tanks', () => {
  const s = createAttack(), h = createHoles(1); s.pieces = 15;
  s.are.push({ amt: 3 }); pending(s, 2, { hardened: true }); pending(s, 5);
  assert.equal(fight(s, 4, r, h).cancelled, 4); assert.equal(s.are.length, 0);
  assert.deepEqual(s.pending.map(p => p.amt), [2,4]); assert.equal(tank(s,r,h),6);
});
test('surge precedes ordinary and AC is separate', () => {
  const s = createAttack(), h = createHoles(1), phases = []; s.btb = 11; s.pieces = 15; pending(s, 20);
  const result = resolveAttack(s, { lines: 2, spin: 'none' }, r, h, phase => phases.push(phase));
  assert.deepEqual(phases, ['surge','surge','surge','ordinary']);
  assert.deepEqual(result.surge.map(x => x.generated), [2,2,3]); assert.equal(s.btb,0);
  phases.length = 0;
  resolveAttack(s, { lines: 4, spin: 'none', allClear: true }, r,h,phase => phases.push(phase));
  assert.deepEqual(phases,['ordinary','all-clear']); assert.equal(s.btb,2);
});
test('errata: recognized mini gets spin B2B and garbage-special bonus', () => {
  const amount = (lines, spin, garbageRows) => resolveAttack(createAttack(),{ lines,spin,garbageRows },r,createHoles(1)).normal.generated;
  assert.equal(amount(4,'none',1),5); assert.equal(amount(2,'full',1),5); assert.equal(amount(2,'mini',1),2);
  const s = createAttack(), h = createHoles(1);
  resolveAttack(s,{lines:1,spin:'mini'},r,h); assert.equal(s.btb,1);
  assert.equal(resolveAttack(s,{lines:1,spin:'mini'},r,h).normal.generated,1);
});
test('zero passthrough acknowledgement ledger and per-peer isolation', () => {
  const s = createAttack(); send(s,4,'A','B');
  assert.equal(receive(s,{from:'B',iid:9,ackiid:0,amt:3}),null);
  assert.deepEqual(s.outgoing.B,[{iid:1,amt:1}]);
  assert.equal(receive(s,{from:'B',iid:10,ackiid:1,amt:3}),1);
  assert.equal(pendingCount(s),3); assert.equal(s.pending[0].active,false);
  send(s,2,'A','B'); assert.equal(s.outbox.at(-1).ackiid,10);
  receive(s,{from:'C',iid:1,amt:2}); assert.equal(s.outgoing.B[0].amt,2);
});
