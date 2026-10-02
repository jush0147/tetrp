# H1 on/off against frozen Legacy: fixed paired KO experiment

Authorized by the user's「開始／繼續」after short diagnostic 37023218685. H1 activation was demonstrated; benefit remains unknown. This replaces the invalid mirror head-to-head, not the evaluator or authority.

## Fixed question and sample

Does disabling H1 change KO win rate against the original vendored Tetrp Kiwi snapshot-v3.2? Legacy is not stock upstream CC2. Both treatments start independently from accepted; only `pending_safety=1` versus `0` differs. H9 remains -0.5. No visible-T change or weight sweep.

100 prespecified base-seed blocks, four games per block, 400 scored KO games total:

1. H1 on vs Legacy, tested policy in seat 0.
2. Legacy vs H1 on, tested policy in seat 1.
3. H1 off vs Legacy, tested policy in seat 0.
4. Legacy vs H1 off, tested policy in seat 1.

Thus each treatment plays 200 games against the same opponent and identical seed/seat conditions. Both players in each game share the piece seed. Seed = 2026160001 + block*100; seat hole seeds = seed+1/+2. Previous diagnostic seed/results are excluded. There are 100 independent analysis units, not 400 independent games.

If any of a block's four games has simultaneous KO, archive the entire attempt as unscored for the primary analysis and rerun all four at seed+4*attempt. At most 25 attempts, with disjoint seeds across blocks. This preserves exact on/off/seat pairing; report retries and their discarded outcomes. The resulting estimand is conditional on decisive blocks under this prespecified retry scheme. A technical failure or exhausted retry limit makes the batch incomplete, never a loss or a replacement win. No score-dependent extensions.

For each final block, d = (off wins across both seats - on wins across both seats)/2. Report each treatment's KO score, mean d, and paired approximate 95% t interval (100 blocks; multiplier 1.984). Positive d favors disabling H1. Report the block distribution and individual games. The interval is approximate; a null result, sparse discordances, or zero observed variance does not establish equivalence. Even clear evidence is specific to this Legacy opponent; no automatic promotion.

## Unchanged fairness and correctness

- Frozen gate/build artifact from run 37004950142, already used successfully in short run 37023218685. Verify manifest/gate identity, exact binary hashes, and configuration differs only in H1; validate vendored JS/WASM hashes.
- PublicSnapshot through existing prepareKiwi/normalizeTopRecommendation for both policies; unknown bag and finite visible tail; 200k nodes per request. Actual Legacy WASM schema checked locally.
- Exactly 24 virtual frames/placement for both seats. Existing parallel decision barrier and sole Tetrp authority `tl-placement-v1`. No physical transport change, candidate fallback or weaker search budget.
- No ordinary gameplay frame cap. KO only. The existing 360,000-frame watchdog is a technical bound, never a winner.
- Audit top-1, Hold/reanalysis, placement, spin/cells/lock/clear through authority, count parity events against requests/results; any mismatch fails. Full public requests/reports, policy actions and authority provenance/events retained. Private events are diagnostic only.
- Unlike the activation diagnostic, no shadow on/off search per request. Each game executes just its designated policy and Legacy.

## Execution and bounded resources

Workflow `.github/workflows/kiwi-h1-common.yml`: 100 independent block jobs, max 16 simultaneous runners, existing two isolated game processes per runner. Frozen binaries reused; no repeated Rust builds. Every 25 placements writes progress. Four games/block, two waves ordinarily. Game step 80 minutes, job 90 minutes, fail-fast on technical failure. These are resource limits, not gameplay adjudication. No automatic rerun of incomplete batches.

Finished traces gzip level 1, retain three days; summaries/results retain 30 days. Aggregate verifies all blocks, settings, policy identities, commit and correctness before publishing statistics. One ntfy completion/failure message to `just_a_kiwi_for_tetrp`. No polling loop, recurring automation, or auto-follow-on experiment. Full KO duration cannot be inferred from the 100-placement diagnostic; do not promise a finish time.

Local validation: plan/paired scoring/retries, fail-closed errors, worker pool, existing parallel barrier and authority tests; run details recorded separately after dispatch. Bot, engine, viewer, and production artifacts unchanged.
