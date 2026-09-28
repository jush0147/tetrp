# Profile the accepted corrected kernel before optimizing

After the audited 6–7 FT7 and 13–11 paired replication, keep rules/search/evaluator and 200k node budget unchanged. No new strength batch or production replacement.

Corpus: 12 detached PublicSnapshots from corrected policy decisions in batch run 36344255039, legs 0/4/12/20 (all corrected seat 0), selected at request-index fractions .2/.5/.8 of each transcript. Selection is deterministic and independent of action quality or latency. Includes source transcript hashes, but no raw events/checkpoints/hidden queue enter the request. This small corpus spans real trajectories; it is not a population-level latency sample.

Profile the exact accepted WASM artifact and vendored reference in fresh Node 24 processes with V8's 1ms CPU sampler. No Rust instrumentation/rebuild. Corrected artifact retains Rust names; the vendored artifact may expose only numeric WASM function indices, so do not assign unsupported names to its samples. Actual browser cost remains established only by browser measurements; Node sampling helps locate the same WASM kernel's hotspots.

For each module: prepare geometry outside the sampler; one warmup per snapshot; two unprofiled timing passes; one separately profiled pass. All three subsequent complete recommendation reports must equal warmup reports, not just top-1. Normalize each warmup top-1 through the authority adapter. Save raw .cpuprofile, complete reports, unprofiled latencies, geometry time, artifact and corpus hashes.

Summaries include only samples whose ancestors contain the explicit profiledSearch wrapper, excluding inspector start/stop overhead. Full raw profiles retain excluded samples. Inclusive percentages overlap; never add them. Release inlining and limited sample size constrain attribution. Memory allocation, hash tables, move generation, evaluation and DAG work are hypotheses, not preselected conclusions.

Local harness smoke: two real snapshots at 2k nodes, both modules, six full-report parity checks per module pass. Corrected Rust symbols appear in samples. Low sample counts are only harness validation, not a performance conclusion.

Actions runs the complete 12-state 200k workload and sends ntfy. Based on results choose one behavior-preserving optimization, then require complete output parity, existing rule/movegen correctness gates and actual browser timing before acceptance. No optimization has been implemented yet.
