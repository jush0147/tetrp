# H9-off: candidate gate, then fixed 200 KO games

2026-10-02: user authorized this workflow after explicitly clarifying that
the existing H9 weight is -0.5 and the candidate sets it to zero. This is
mechanism ablation, not weight optimization. Opponent is accepted Tetrp-aligned
CC2 baseline, not original Legacy and not Native Kiwi v0. No visible-T changes.

## Gate before arena

Restore source pin 2e243242b674d57491f99b445f75e35fc48a0e26 plus accepted
landing-final.patch from run 36387270053. Only production source delta is the
H9 coefficient in review_h9_h12, switched by h9_off cfg. Append test-only Rust
cases and the same stdio wrapper already validated in native runtime work.

- Build default and H9-off with Rust 1.90.0, locked dependencies, release.
- Run snapshot regressions and same-state full evaluator tests for both.
  Reward must be unchanged; Eval difference must equal removed H9 term on
  sealed/open/equal-hole fixtures. These are feature checks, not win evidence.
- Export full configs: default equals ACTIVE_PARAMETERS_2026-09-28; candidate
  equals default except h9_cavity_excavation=-0.5 -> 0.
- Rebuilt default full reports/actions must equal the frozen accepted native
  binary on the existing public performance corpus (no new replay harvesting).
- Candidate top-1 placements must commit through Tetrp with certificate,
  spin/cells/frame/clear parity. Policy-selected Hold must reanalyze; explicit
  empty/occupied Hold fixtures also validate candidate post-Hold placements.
  Fixture future suffix is synthetic and belongs only to the referee.
- Freeze candidate binary hash into the runtime manifest only after passing.

Build/gate failure prevents every arena shard from starting and sends ntfy.
There is no mandatory separate 8-game pilot or additional performance study.
This gate does not claim new WASM/browser deployment certification: this is
an offline native arena experiment; the shipped bot is unchanged.

## Fixed experiment

H9_OFF_200.json fixes 100 new base seeds, two swapped seats each, 200 single
KO games. Both players get the same piece stream within each game. Same
200k node budget, 24 virtual frames per placement, PublicSnapshot boundary,
Hold reanalysis and Tetrp tl-placement-v1 authority as the last batch.
Native dual-seat parallelism and two isolated match workers per runner are
reused; wall-clock compute time never advances gameplay time.

Reuse the existing batch runner with a manifest-selected candidate name/hash.
50 shards × four legs; max 16 concurrent runners, two match workers each.
Gate has 40-minute technical timeout; shards 180 minutes (170-minute game
step). Simultaneous KO unscored, predefined base+4*attempt retries, at most
25 attempts. Gameplay watchdog/technical failure makes the batch incomplete,
not a loss or excluded sample. Fail-fast, no automatic rerun or score-driven
extension. No H1 dispatch or automatic promotion.

All 200 games must pass correctness. Report paired seed-block outcomes and
uncertainty, not 200 independent Bernoulli samples. Previous visible-T results
and gate fixtures are excluded. If inconclusive, keep accepted unchanged.
No claim that this identifies the best H9 weight or beats original Legacy.

One ntfy completion/failure message on just_a_kiwi_for_tetrp. No live monitoring.
Full traces retained three days; configs, binaries, gate and summary 30 days.
Previous batch took 1h46m; this is a reference, not a promised duration.
