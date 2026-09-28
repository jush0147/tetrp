# Profile the accepted dense baseline

Follow-up to [eight-game integration](RESULT_36382935572.md). No bot changes. Determine the remaining bottleneck before choosing another optimization.

Reuse exact artifacts from runs 36380902069 (dense) and 36323060219 (pre-dense corrected reference), checking WASM and JS hashes. Use the existing 12-state public corpus at 200,000 nodes. Each module runs in a fresh Node 24 process: warmup, two unprofiled passes, then one V8 CPU-sampled pass at 1 ms intervals. Require full-report equality within each artifact and across the two artifacts; 36 within-artifact checks per arm plus 12 cross-artifact report pairs. No private future, evaluator, budgets or rule changes.

One short finite Actions job, no Rust build or browser installation. Both arms run sequentially on the same runner to avoid mixing machine differences into the diagnostic timings. Independent arena games benefited from eight-way parallelism; this paired profile favors same-runner measurement. Maximum job duration 15 minutes, artifact upload on failure, one ntfy completion/failure notification.

Save raw cpuprofiles, reports, geometry/preparation timing and unprofiled search timings. Read inclusive stacks without double counting; account for inlining. Inspect movegen, remaining landing-map hashing, DAG/GameState hashing, heap and evaluator work without assuming the next target. Node profiling is diagnostic, not browser performance acceptance; any future optimization must separately pass browser parity/performance gates. No automatic next experiment or deployment.
