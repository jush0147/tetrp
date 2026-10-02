# H1-off: candidate gate then fixed 200 KO games

2026-10-02: user authorized continuing the next planned mechanism after the
H9-off 80–120 result. Keep accepted baseline, including H9=-0.5. Candidate
only sets pending_safety=1 -> 0 in review_h9_h12. No visible-T change, no
new weights, no original-Legacy comparison or production replacement.

Question: does the extra pending-garbage-conditioned board penalty improve
KO results in this complete policy? This does NOT disable actual incoming
garbage, cancellation, defensive search or ordinary board penalties. H1
semantics are already documented in H1_SEMANTIC_RESULT.md; no new rule-model
change is proposed. Inconclusive means retaining accepted, not proving H1
useless. Off losing supports retention, not optimality of weight 1.

## Gate

Reuse frozen source pin 2e243242b674d57491f99b445f75e35fc48a0e26 with accepted
landing-final.patch from run 36387270053. Only production source change is
the pending_safety assignment, behind h1_off cfg. Test-only Rust additions
and the previously validated stdio wrapper do not change the policy.

Build default and candidate on Rust 1.90.0, locked dependencies, release.
Run snapshot regressions and full-evaluator same-state tests. Check empty
board, covered hole, and height16; pending 0/4/8/16/20; ready and delayed
packets. Eval difference must equal removed H1 term; Reward unchanged.
This covers zero-pressure, zero-danger and cap16 boundaries, not win rate.

Compare exported default config against the accepted source inventory;
candidate differs ONLY in pending_safety, with explicit H9=-0.5 assertion.
Rebuilt default full reports/actions must equal the frozen accepted native
on 12 existing public snapshots. Candidate top-1 commits must pass Tetrp
placement parity, including policy Hold/reanalysis plus explicit both Hold
modes. Only then write binary SHA-256 into the runtime manifest and allow
the arena jobs to start. Build or gate failure stops and sends one ntfy.

## Arena

H1_OFF_200.json fixes 100 fresh seed pairs / 200 single KO games. Same
piece seed within each game; policy seat swap per pair, seat-fixed hole
streams. 200k nodes/request, 24 virtual frames/placement, snapshot-only,
standalone Hold reanalysis, Tetrp tl-placement-v1 authority and mandatory
top-1/spin/cells/lock-frame/clear/Hold parity. No physical input transport.

Reuse the verified native parallel runner and batch scripts unchanged:
50 shards, four games each, max16 concurrent runners, two match workers
per runner. Gate40min; shard180min (game step170min) technical timeouts.
Watchdog360000 is technical failure, never gameplay adjudication.
Simultaneous KO unscored and retried via predefined base+4*attempt, max25;
report retry divergence. Technical failure aborts; no automatic rerun,
optional extension, further candidate, or promotion.

Aggregate requires all 200 audited KO games and computes paired-block
outcomes/uncertainty. Exclude previous experiments and gate fixtures.
Finish/failure sends ntfy just_a_kiwi_for_tetrp; no live monitoring.
Full traces three days; build/configs/summary 30 days. Last two batches
took 1h18m and 1h46m; actual H1 duration depends on game lengths.
