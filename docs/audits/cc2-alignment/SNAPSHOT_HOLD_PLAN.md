# Snapshot standalone Hold / reveal boundary

2026-09-27. Use the accepted isolated spawn candidate; no evaluator changes.

Thirty requests from sixteen actual authority Hold transitions, arranged as eight paired hidden tails. Six pairs cover empty/occupied/same-type Hold and same/different first NEXT on empty boards; two cover a blocked replacement spawn, with and without previous-clear clutch. Dead post-Hold states do not issue reanalysis requests. Cases include only public snapshots in request payloads.

For each pair, only the private N6 differs. Pre-Hold requests must be byte-structure identical. Hypothetical empty Hold contains new current plus four known NEXT pieces (five total); occupied Hold contains current plus all five NEXT pieces. Tetrp commitHold is invoked with mandatory reanalysis intent. After an empty Hold, the new snapshot includes the newly revealed fifth preview; occupied Hold must not reveal that hidden piece. The after request is locked and must contain no Hold candidate.

Audit wrapper calls the real Rust parse, post_hold_root and analyze_text functions; it does not substitute its own Hold model. Compare helper prefix and emitted standalone Hold action against authority, then analyze the fresh post-Hold request. Paired pre-Hold Rust results must agree despite different hidden tails. A fixed 2000-node budget is diagnostic only; ranking/strength is not the objective.

Local generation passed: 30 requests, eight pairs, sixteen authority transitions. Rust results pending Actions. Run original snapshot tests and retain 141 lifecycle, 1746 rotation and 43 geometry/cost regressions. No production WASM replacement or FT7.
