# Registered candidate: drained frontier one-placement reranking

2026-09-23. Registered before arena execution. Hypothesis: stopping at first
garbage reveal hides realizable immediate continuations that the unchanged
evaluator would value. No B2B, Mini, TSD bonus or weight adjustment.

## Implementation contract

- `analyzeFrontier` is an opt-in wrapper; browser/default search still calls
  `analyze`. Base search adds only a read-only capture hook and optional retained
  public-model outcomes. Historical default candidate/score/count regressions pass.
- Freeze the base search's published best prefix per root. Do not rerun the beam
  or recover previously pruned prefixes. Extend eligible leaves by one placement,
  then rerank the original root actions; Hold stays standalone with reanalysis.
- Initial narrow gate: one public pending packet, known activation, inserted
  garbage in every modeled outcome, no remaining pending, known current and at
  least two already-known next pieces in each surviving scenario.
- Existing scenario distribution and weights unchanged. After reveal, current
  and legal Hold placements are enumerated without beam pruning. No extra NEXT
  or future arrivals. Remaining garbage is empty, so no unrevealed hole can leak.
- Choices/cache keys depend on revealed model state, not scenario identity.
- At least one surviving scenario is required. Dead scenarios retain the
  original death value. Unsupported cases retain the original cutoff.
- Extra per-request cap: **500000 geometry states / 50000 placement evaluations**,
  separate from unchanged main **100000 geometry / 200000 node / beam 32** limits.
  Incomplete movegen or exhausted budget discards all staged extension scores;
  original candidate list is returned exactly. This is an all-or-nothing policy
  comparison, not an execution fallback to candidate #2.
- Published candidate metadata separates baseline score and extension depth/value.
  Per-profile cumulative diagnostics record requests, applied extensions,
  changed top-1, additional work/time, exit reasons and base depth/completion.
- Different prefixes can still end at different virtual times. This experiment
  does not solve equal-horizon evaluation or estimate unknown opponent pressure.

## Arena registration

- Two arms, one FT7 each against unchanged Legacy: extension off vs on.
- Main geometryBudget stays 100000 in both. No geometry-budget expansion mixed in.
- Base seed **2026092402**, identical per-attempt seed schedules across arms,
  alternating seats, fixed 24 frames/placement, snapshot-only, authority KO only.
- Strict top-1 execution, parity gate, no normal frame cap; watchdog/technical
  failures never score and stop unattended series; simultaneous KO unscored.
- FT7 may stop at different lengths; compare common attempt indices as matched
  seeds/seats. Not a fully balanced fixed-game tournament or promotion proof.
- Only KO win rate is strength evidence. APP, application rate, root changes,
  baseline cutoff frequency and added latency are diagnostics.
- No automatic default change or follow-up tuning. Browser defaults remain off.
- GitHub Actions runs independently and sends the requested ntfy topic a result
  or failure notification per arm. No agent polling of ongoing battles.

## Validation and provenance

The two frozen state regressions match the authority-checked offline probe,
including every original root's extended score. Additional tests cover atomic
budget discard, unsupported timing/packets, opt-in behavior and telemetry.
The historical source hash in the earlier audit remains the historical hash;
current instrumentation was updated for the read-only capture signature and its
differential tests still compare the original five top-1 decisions and scores.

Reproduce a series with:

```sh
node scripts/kiwi-ft7.js .cache/frontier-series 2026092402 100000 on
```

The separate offline probe remains available and is not imported by production.

Local preflight: the 410-test suite passed, followed by the updated six-test
frontier suite (including the added private-field access guard); frontend build
passed. Actions runs the complete resulting suite before either arena arm.
The saved `candidate-cost.json` single-run Node sample reports approximately
2.04 s / 2.21 s extra time for F1032 / F1056, using 286680 / 292250 extra geometry
states and 18220 / 9630 evaluations. These are diagnostics, not browser latency
certification. No performance optimization or policy weight change was mixed in.
