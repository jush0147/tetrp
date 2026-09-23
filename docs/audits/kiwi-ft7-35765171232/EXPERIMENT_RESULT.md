# Geometry budget pilot result

Reviewed 2026-09-23. [Actions run 35843812498](https://github.com/jush0147/tetrp/actions/runs/35843812498), commit `2dc462f49226c0e9ec401dc5dd68b0f49ffd9343`.
Both arena jobs and both ntfy jobs completed successfully.

## Correctness and control

Both manifests have identical code hashes, Legacy artifact/config, Native settings
apart from geometryBudget, and base seed 2026092401. All seven attempt indices
have matching piece seeds, hole seeds and seats across the two arms. Seats
alternate each attempt. Both use the same 24-frame placement cadence, snapshot
adapter and `tl-placement-v1` authority; wall-clock search time does not alter
gameplay cadence. No ordinary gameplay frame cap.

|Check|100k control|1M candidate|
|---|---:|---:|
|Native : Legacy KO score|0 : 7|0 : 7|
|Scored rounds|7|7|
|Placement parity|660 / 660|1204 / 1204|
|Hold parity|192 / 192|354 / 354|
|Parity mismatches|0|0|
|Technical failures|0|0|
|Fallback requests / rejected candidates / maximum selected rank|0 / 0 / 0|0 / 0 / 0|
|Watchdog / simultaneous KO / unscored rounds|0|0|

Every placement counter equals actual placed pieces and every Hold counter equals
actual Holds. The fail-closed authority commit jointly checks pose, occupied cells,
spin, lock frame and clear. No unsupported-rule or certificate failure occurred.
These artifacts contain aggregate parity, not full per-decision traces. This is
execution-contract correctness, not proof of complete search-model correctness.

## Diagnostics (not strength criteria)

|Native metric|100k|1M|
|---|---:|---:|
|Placements|330|602|
|Generated|123|365|
|Cancelled|39|153|
|Newly sent|90|215|
|Tanked|220|345|
|Generated / placement|0.3727|0.6063|
|Newly sent / placement|0.2727|0.3571|
|Cancelled / placement|0.1182|0.2542|
|Tanked / placement|0.6667|0.5731|
|Mean search request time, ms|565.7|1445.7|
|P95 search request time, ms|932.8|3513.8|
|Maximum search request time, ms|1149.1|4270.4|
|Whole series runtime|10m 15s|29m 23s|

Request timings include standalone Hold reanalysis requests and are from GitHub
Actions Node runners, not browser benchmarks. Different trajectories produce
different state distributions, so this is not a same-snapshot microbenchmark.
Legacy mean request time was similar between arms (857.5 / 845.7 ms).
Legacy generated APP was 0.9242 / 0.9950 in the two respective arms.

|Seed/seat matched attempt|Native placements, 100k|Native placements, 1M|Winner in both|
|---|---:|---:|---|
|1|41|70|Legacy|
|2|54|93|Legacy|
|3|41|59|Legacy|
|4|40|114|Legacy|
|5|44|46|Legacy|
|6|74|79|Legacy|
|7|36|141|Legacy|

All seven candidate games last longer, but survival duration never awards wins.
Generated APP increases in five of seven individual matched games, not all seven.
Aggregate totals are duration-weighted and cannot by themselves establish a
better policy. Opener defense means generated need not equal cancelled + sent.

## Interpretation and next hypothesis

The controlled budget increase changed play and improved aggregate production
and cancellation diagnostics, but produced **no observed KO win-rate gain**.
It does not prove the two budgets have equal population win rates, nor does it
prove that search is irrelevant. There are only seven matched seeds against one
opponent. Do not promote 1M to the browser default on this evidence; the latency
cost is substantial and browser responsiveness has not been measured here.

The original decision audit already showed that geometry budget cannot extend
search beyond its first-uncertain-reveal cutoff. This experiment does not record
completed depths or cutoff reasons per request, so it cannot show how often that
limit dominated the new games, or whether Mini/B2B behavior changed.

Recommended next step is a separate, small **offline frontier diagnostic**, not
another large arena run or weight sweep: take the already saved G3 F1032/F1056
snapshots, keep evaluator/weights fixed, and compare the existing immediate
frontier evaluation with exactly one additional placement after modeled garbage
reveal. All root choices must precede the reveal; continuation can adapt only to
that scenario's revealed board and already-known pieces. Do not append the real
hidden queue or use actual hidden holes. Use identical scenario probabilities
and expand all legal one-placement continuations so this probe isolates cutoff
value rather than mixing in beam changes. Check whether the B2B-preserving branch
actually gains realizable attack/cancellation value; if it does not, do not add
a B2B bonus merely to make it win the comparison.

This diagnostic has not been implemented or run, and no further Actions runs
were launched during this result review. Any subsequent candidate still requires
fair KO arena evidence before a strength claim.
