# Visible-T fixed 200 KO games — 2026-10-02

User authorized the overnight run. Run only the already prepared visible-T
candidate versus the accepted CC2-based profile. H9-off and H1-off remain the
next independent experiments, in that order; neither is queued or built here.
The abandoned 48-game draft is not used.

## Frozen protocol

`VISIBLE_T_200.json` fixes binary SHA-256 identities, the native artifact run,
100 new base seeds, 200 single KO legs (not FT7 series), budget and retries.
The previous 8-game pilot is excluded. Every pair swaps policy seats; within
each game both players have the same piece stream. Hole streams remain bound
to seats (seed + 1/+2). This is not original CC2 versus Native Kiwi v0.

Both policies receive only PublicSnapshot current + NEXT 5, with no hidden
future or history. Use 200,000 nodes/request, standalone Hold reanalysis,
24 virtual frames/placement, Tetrp tl-placement-v1 authority, zero fallback,
and full placement/Hold/spin/cells/clear/lock-frame parity checks.
Native dual-seat asynchronous search changes wall time only: decisions join
before advancing virtual time or exchanging attack. Two isolated matches run
per runner, as verified by run 36887925067.

Only KO scores. Simultaneous KO scores nothing and retries that leg using
base + 4 * attempt, at most 25 attempts. If the paired legs retry differently,
report that divergence; do not silently call their final streams identical.
Watchdog (360,000 virtual frames), technical error, certificate failure or
job timeout makes the batch incomplete, never a scored loss or excluded
observation. Fail-fast cancels queued/running shards on a technical failure.
There is no ordinary gameplay frame cap or automatic rerun.

## Bounded execution and reporting

50 shards × 4 games, maximum 16 concurrent standard runners, two independent
match workers per runner. Each shard has a 180-minute job limit; its game step
has 170 minutes to leave room for artifacts. No score-dependent stopping,
extension, automatic promotion, or automatic next experiment.

Summaries are retained 30 days. Full snapshots, reports and authority events
are compressed losslessly and retained 3 days, including any diagnostic dumps.
The aggregate downloads only compact summaries, requires all 200 audited
games, and reports KO score, 100 paired-block outcomes, approximate paired
95% interval and exact sign test on non-tied pairs. These are not 200
independent Bernoulli observations. A completed batch may still be inconclusive.
The aggregate sends one completion/failure notification to ntfy
`just_a_kiwi_for_tetrp`; no continuous monitoring is required.

Observed two-match pool throughput was 20m09s for two games on one seed pair.
At that rate 200 games/16 runners is about 126 minutes before scheduling and
tail effects. Allow roughly 3–4 hours as an uncertain planning estimate, not
a promise: new seeds may yield much longer games or hardware contention.

## GitHub Actions use

Official limits checked 2026-10-02: Free standard runners allow 20 concurrent
jobs, matrices up to 256 jobs, hosted jobs up to six hours each. This batch
uses 16, 50 and three hours respectively. Testing this repository's own bot
implementation is directly related software testing. Staying under limits
does not guarantee GitHub will accept any resource load; the terms also
prohibit disproportionate burdens. Keep the run finite, avoid duplicate runs,
and stop on technical failure instead of retry loops or continuous self-play.

- https://docs.github.com/en/actions/reference/limits
- https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#actions
