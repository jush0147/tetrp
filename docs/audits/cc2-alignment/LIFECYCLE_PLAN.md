# Hold / spawn / clutch diagnostic, first slice

2026-09-27. Fixed CC2 kiwi-v1 pin, full-reference mid-descent patch. No evaluator or production change.

133 conditional fixtures: 36 Tetrp spawn KOs, 33 clutch rescues, 20 Hold attempts. Empty-board cases cover empty/occupied/same-piece Hold, same current/NEXT[0], and locked Hold rejection. Obstruction cases cover piece-dependent spawn collision, last-clear on/off, disabled clutch and a sealed spawn region.

Rust calls the actual public Bot player_pieces, has_legal_move, one budget-complete do_work_limited expansion, ranked_suggestions and try_play APIs. Tetrp oracle spawns, optionally Holds, slams and locks. Compare initial public piece representation, terminal-spawn continuation, current spawn move availability, Hold rejection immutability, post-placement known current/Hold/NEXT and refill count. Never pass actual newly revealed private queue to Rust.

The source-level risk is that has_legal_move and Freestyle::do_work can consider reserve moves even if the current piece cannot spawn. A Tetrp terminal spawn cannot be rescued by Hold. This is a hypothesis pending Rust execution, not a confirmed arena failure.

The generic Bot macro-placement API is not the snapshot standalone Hold API. Its result is evidence about core representation/lifecycle only; the snapshot post_hold_root and mandatory reanalysis boundary remain a subsequent check. Likewise supplied high boards and previous-clear flags are conditional states, not proof that a match reached them. The generic root expansion exercises the shared move-merging logic but is not a full deep-DAG rollout.

All mismatches are saved, not silently corrected. Workflow success means the diagnostic executed, not model parity. Existing 1746 rotation and 43 landing/cost regressions remain in the run. Artifacts include cc2-lifecycle-results; ntfy reports this diagnostic's summary. No FT7 until lifecycle and integration correctness are resolved.
