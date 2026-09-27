# Four-placement public-prefix and DAG replay audit

2026-09-27. Continue from accepted combined build (run 36309185307). No new rules/evaluator correction.

24 transcripts × four placements = 96 transitions. Six starting conditions: empty/plain, inactive packet head, activation at frame 24 with hole scenario 4, charged quad, late-clock quad, charged full-spin single. Cross empty/occupied initial Hold and no Hold versus one Hold before placement two. Every action is authority-certified; subsequent placements are simple hard drops. These fixed transcripts test transitions, not policy strength.

Initial current+NEXT5 only. No newly revealed queue is appended in Rust. Empty Hold may reveal a private piece in the oracle, but the transcript stops before using it and compares only the original known prefix. Hypothetical garbage-hole scenario is explicitly fixed for both sides. Every four-step trace was generated locally without terminal truncation.

The persistent Rust Bot retains GameState and Forecast across all steps. For each action compare board, garbage rows, combo/B2B, packets, generated/cancelled/sent/tanked amounts, pending schedule, elapsed time, multiplier and known current/Hold/NEXT against Tetrp. Unlike the one-step fixtures, elapsed/pending times remain relative to the original trace origin, and attack totals are differenced per step.

DAG observer stores published `(full parent state, next, placement) -> full child state` pairs. At publication, recompute the shared transition and require full equality; when actual Dag::select replays an edge, compare its result to that earlier child. Full GameState equality includes Forecast and empty-Hold lineage. Each step performs bounded real DAG work (up to 4000 nodes/100 selections); require zero speculative expansions, at least one replay and depth >=2 across the run. Failures include Rust assertion state output in artifacts.

This observer is diagnostic-only, not a production memory/performance design or proof of hash-collision safety. Its map does not independently inspect StateMap bucket contents. It checks published edge-state consistency and selection replay. It does not certify arbitrary queue lengths, all action sequences, future information gain, or physical timing.

Run the existing 2038 combined checks first, then install the observer and execute the 96 trace comparisons. Artifacts include source instrumentation and raw output. Notify via ntfy and leave the run unattended. Rust build/parity results pending.
