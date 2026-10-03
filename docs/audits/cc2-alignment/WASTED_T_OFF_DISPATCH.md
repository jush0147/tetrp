# wasted-T off dispatch

2026-10-03 latest: https://github.com/jush0147/tetrp/actions/runs/37098444257 (238f807eaa6acaf6d8301913c5f265bf883d01c3), confirmed queued. Reuses compiled binaries from37096877026, adds55fixed public T-available states to original12, total67. See WASTED_T_GATE_37096877026.md. No relaxed gate or bot change; gate success alone unlocks the already-authorized200new games. Prior run37096877026 finished with10score changes but0top1 changes; correctness checks passed, no arena ran. Below is dispatch history, not current active status.

- Active corrected run: https://github.com/jush0147/tetrp/actions/runs/37096877026
- Source commit: cc113e3 (branch codex/kiwi-ft7-actions). Manual workflow dispatch returned this URL; no duplicate push-triggered run for the fix because the workflow file was unchanged.
- Plan: [WASTED_T_OFF_PLAN.md](WASTED_T_OFF_PLAN.md). Gate then200new candidate games, all100previous accepted seed/seat controls reused. No new experiment in parallel, no automatic promotion or follow-on.
- First run37096791617 failed before build/arena at the asserted unique source anchor: softdrop assignment occurs twice. No games ran. Failure ntfy succeeded. Fixed by anchoring the unique accepted pending_safety assignment, without changing its value; only appends wasted_t=0 under cfg. Verified transform against actual cached accepted source; added duplicate-softdrop regression test. Seven wasted protocol/transform tests pass after fix; previous25targeted checks and4provenance checks passed.
- Latest run still needs Rust/full-report/real activation/authority gate. Do not claim those passed from local tests. Gate fail stops all arena and notifies; successful gate automatically launches planned candidate games; aggregate notifies completion/failure.
- Reuse locally verified via full artifact hash, original paired aggregate and unchanged committed environment. Candidate comparison is follow-up evidence with an observed shared control, not fresh independent confirmation.
- On return inspect latest run, gate/config diff and activation, then all blocks/parity/KO and control identity. Exception: simultaneous KO reruns whole paired block including accepted on predefined replacementseed, so count/report any extra games rather than claiming exactly200new in that case.
- Preserve unrelated working changes. No continuous monitoring configured.
