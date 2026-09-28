# Independent landing-cost browser replication

Confirm [initial result 36387270053](RESULT_36387270053.md) using a fresh Actions runner/process with exactly the same built artifacts, public corpus and browser harness. No compiler, rule, evaluator, transport or arena changes.

- Candidate: run 36387270053, SHA256 `ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767`.
- Reference: accepted dense visited run 36380902069, SHA256 `bd21800742a8d5abd54118cb51f458fb987d8f6c4f5e6cd940b12ae4deafa6ba`.
- Verify both WASM/JS hashes and corpus hash before running. Copy only package files into fresh output locations; prior summary/rows cannot serve as current results.
- Same 12 snapshots, 200,000 nodes, five passes, alternating arm order, four warm means per state, nearest-rank median paired reduction. Require 60 full-report pairs identical and 120 browser top-1 authority checks.
- Unchanged >=5% median improvement / no state >5% slower gate. A valid completed measurement can fail performance; report that distinction. Keep raw rows, hashes, timing and memory.
- One finite 15-minute job, no rebuild or arena. One ntfy on completion/failure, always upload partial output. Existing Rust/authority suites are not claimed as rerun.

Assess this run together with the initial measurement before deciding whether to retain the candidate. Do not automatically deploy or schedule follow-up work.
