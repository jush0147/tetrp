# Resource rollout pilot — frozen protocol

2026-09-24. Offline measurement only; no policy/evaluator promotion, no FT7.

Question: can equal-cost public-only receding-horizon continuations distinguish two fixed roots, and does the preference survive changing the continuation policy?

Known cases: G1 F24/F48/F120, use the previously frozen Native and Legacy placement roots. Validation: first three distinct Native decision frames after 144 in verified G3 reconstruction with pending empty; select before candidate outcomes. Freeze Native-default and Legacy top-1 at each; if equal, retain the case and report no disagreement, do not replace it. Root Hold is allowed and followed by fresh analysis. Snapshot inputs only, no raw replay future.

48 trajectories: 6 snapshots × 2 fixed roots × 2 continuations × 2 synthetic tails. Each lasts 8 placement slots including the root, at 24 frames per slot, unless authority death occurs. Continuations: unchanged Legacy 200k node profile; Native original sent-safety with horizon 1, geometry 100k/node 200k. Each root gets the same slot/request limits under each continuation. Different policies have different computational costs; never call this equal wall-clock effort across policies. At most one Hold and reanalysis per slot. No ranked fallback.

Tail seeds fixed at 41001 and 41002, unrelated to replay RNG. IID uniform piece samples are an explicit robustness assumption, not an inferred SevenBag remainder. The environment privately preloads enough synthetic pieces; each decision receives only visibleState (NEXT exactly 5). Each root shares the same initial public queue and the same exogenous tail stream, consumed according to actual Hold/spawn. No synthetic future is delivered all at once to the continuation policy. No future incoming is injected and all inputs have pending empty: this first pilot isolates attack realization and continuation bias, NOT cancellation/tank/garbage robustness. Do not claim it validates the whole resource model.

Use PlacementArenaEngine for every step, validatePlacement/commitPlacement/commitHold, strict top-1 and fixed virtual frame. No second gameplay engine. Record every public decision, attack transaction deltas, line/garbage clears, first attack slot, death, ending public state, board measurements and timing. No weighted outcome score.

Predeclared outcome comparison: within one continuation, A robustly dominates B only if across both paired tails A's survival slots, survival-at-end, generated and sent are all >= B, ending maxHeight/coveredEmpty are <= B when both survive, and at least one inequality is strict. Otherwise report incomparable or equal. These are measured-vector preferences, NOT true state dominance or safe pruning proofs. The ending geometry conditions are a conservative check, not a new evaluator bonus.

Proceed-to-design gate (not online/arena promotion): zero technical/parity failures; F48 Legacy root robustly preferred under BOTH continuation policies; at least two of three validation states have the SAME strict root preference under BOTH policies. Otherwise stop this rollout configuration, do not sweep tails/policies/horizons. Equal roots are not a successful validation case. Known cases do not count as validation wins.

Hard work limit: 8 slots/trajectory, <=16 total policy requests including Hold reanalysis; each policy retains its configured cap. Actions job <=45 minutes with a 30-minute experiment step; timeout is incomplete, never an outcome. Save partial results and ntfy completion/failure. Node timings only diagnose cost; browser feasibility remains untested even if this gate passes.

Frozen inputs are in inputs.json and sufficient to reproduce with `node scripts/kiwi-resource-rollout.js output-directory`; summarize automatically after all trajectories. Validation selection produced G3 F216/F240/F264; F216 has identical standalone Hold roots and remains in the denominator. Do not regenerate inputs after seeing results. The preparatory script requires the earlier local audit/reconstruction files and is not part of the Actions runner.
