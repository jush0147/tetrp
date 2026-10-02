# H1-off batch stopped: mirror matchup never activates H1

2026-10-02: user reported all active shards running over two hours with none
complete. Gate passed; all 16 active shards were in the match step (started
12:10 UTC), remaining 34 queued. GitHub did not expose unfinished job logs
through REST/gh; browser was signed out. No claim of a stalled request was
justified. The runner had no periodic request/frame progress telemetry.

Cancelled run 37004950142 to stop further resource consumption and diagnose.
Confirmed completed/cancelled, all 52 jobs finished, aggregate failed as
expected for incomplete input. No KO strength verdict or automatic restart.

## Concrete evidence

Downloaded successful gate: exact config difference H1 only, default frozen
report parity, candidate placement/Hold checks all passed. Retrieved shard9
summary: zero completed legs. Its trace artifact 11233125360 is 881,965,509
bytes; used HTTP byte ranges to read ZIP directory and only last4MiB of each
leg's reports/events, plus result metadata (no bulk trace download).

Seed2026141801, swapped legs36/37:

- Leg36 reached frame105384 / 4391 placements per player. Both generated
  and sent24161 lines; zero pending, zero tanked, zero received.
- Leg37 reached frame105576 / 4399 placements per player. Both generated
  and sent24232 lines; zero pending, zero tanked, zero received.
- Each tail contains190 complete reports =95 paired decisions. In every
  pair, PublicSnapshot, action and full report are exactly equal across seats.
  All sampled pending and ARE queues empty.
- All72/76 sampled receive events return cid=null. Hole RNGs remain unused
  with lastColumn=null; different hole seeds cannot break this symmetry.

These are two inspected legs, not a full audit of all32 live matches.
Compact evidence: H1_MIRROR_DIAGNOSIS_37004950142.json.
Local tails and verifier: .cache/h1-stall/tails and verify-tail.mjs.

## Causal explanation

H1 is a pending-conditioned penalty. With no public pending packets, the
finite forecast introduces no opponent future packets, so its contribution
is zero. Both otherwise-identical deterministic policies see the same seed,
board and cadence and select the same moves, Hold transitions and attacks.
In src/attack.js receive(), simultaneous outgoing ledgers offset matching
incoming packets before a pending packet is created. With equal attacks,
pending remains empty and the H1 on/off difference stays inactive.

Executed a direct authority-ledger witness: equal simultaneous batches
[2], [9,17], [0], [35,8] all leave pending empty; asymmetric12 versus9
correctly leaves3 pending on the weaker sender. This is ledger offsetting,
not the cancellation counter in the lock transaction (which remains zero).
No evidence here supports altering the authority or attack arrival timing.

This matchup has an unbroken mirror symmetry; more seeds or more runner
time do not target the missing activation mechanism. The gate verified code
correctness but omitted experiment sensitivity/feature activation. That was
the experiment design error. Previous H9/visible-T variants can alter choices
without pending and therefore do not have this same structural restriction.

## Next boundary

Do not repeat the200 direct H1-on/off empty-board matchup, lower search
budget, offset lock times, switch opponents to different piece seeds or
declare a draw/win from time/attack/height. Keep same-seed/equal-cadence rules.

Before another strength batch, choose a fixed behaviorally distinct common
opponent and check on a bounded diagnostic that public pending/H1 actually
becomes nonzero. Then compare H1-on and H1-off against that same opponent
using matched seeds/seats. This is a different protocol and needs a fixed
sample plan; no opponent or new batch dispatched in this diagnosis.
Add periodic frame/request-stage telemetry and interruption-safe compact
progress evidence before any rerun. Do not turn this into another open-ended
performance study. H9 remains-0.5; production unchanged.
