# Isolated spawn-terminal correction

2026-09-27. Based on confirmed six failures in run 36306243988. No production integration or evaluator tuning.

Add explicit `GameState.hold_is_empty`, included in derived equality/hash and updated by the shared advance operation. CC2's normalized reserve denotes active current while Hold is empty, including descendants; once an actual Hold branch is used, reserve denotes held piece. Same-type placement is the existing canonical no-Hold branch; public try_play's explicit Hold flag handles same-type Hold separately. This does not claim a redesign of same-type Hold DAG edge identity.

Before generic root/deep expansion, check actual current spawn/clutch geometry. Never use Hold to rescue terminal current spawn. Authority-supplied active-root allowlists bypass respawn testing; post-Hold hypothetical roots have no allowlist and must pass spawn. Public has_legal_move and try_play use the same geometry guard. This isolates the observed bug without inferring KO merely from an empty move list.

141 paired fixtures: original 133 plus eight empty-Hold spawn controls. Direct try_play attempts now also exercise held-piece placements when current movegen is empty. The gate requires all candidate fields clear, at least six baseline terminal failures fixed, and all previously passing case outputs unchanged. Any technical failure aborts.

Five Rust tests cover empty-Hold lineage over multiple placements, state equality distinction, first Hold, occupied Hold, active-root allowlist behavior, and actual second DAG expansion at dead spawn (both empty and occupied Hold). Rust compile/test results are pending Actions; local source transformation and 141 authority fixtures passed. No local Rust toolchain is available.

Existing 1746 rotation and 43 placement/cost tests continue after the lifecycle gate. Both geometry arms receive the spawn correction; the lifecycle reference arm remains uncorrected for causal comparison. Finite coverage, not full standalone snapshot Hold/reanalysis or browser certification. Candidate source diff is uploaded; completion/failure notification uses cc2-spawn-results summary.
