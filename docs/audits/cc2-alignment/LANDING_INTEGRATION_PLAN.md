# Final landing-cost runner regression

After initial correctness/performance and successful independent browser replication, run the exact landing artifact from 36387270053 through the existing arena. Reuse [dense integration protocol](DENSE_INTEGRATION_PLAN.md): eight parallel Ubuntu jobs, four paired seeds, swapped policies, equal 24-frame cadence, 200,000-node snapshot-only recommendations versus Tetrp vendored Kiwi. No compile, gameplay cap, silent fallback or evaluator change.

Use the same legs/seeds as run 36382935572. Preserve raw JSONL so the result review can compare all ordered `(seat, frame, PublicSnapshot, policyIntent)` events against prior runs, not merely scores. Runtime authority checks every commit and Hold reanalysis. Require eight valid KO legs and zero technical/parity/fallback/certificate failures. Simultaneous KO retries unscored; existing technical watchdogs remain. Artifact checks must select landing WASM `ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767`, not the dense visited predecessor.

One bounded matrix, max-parallel 8, upload partial traces and notify once through ntfy. No automatic follow-up or deployment. This is the final gate for this storage optimization: if complete trace parity passes, fix the new experimental baseline and close the landing-map experiment. These repeated seeds do not add independent strength evidence.
