# Dense visited-cost experiment

Reference: corrected, uninstrumented Kiwi from run 36323060219, WASM SHA256
`892a6cbea43ae280bb09fc9d993a7e9d51307e39881aff9b92fb5c37177063fa`.
Motivation: [CPU profile](RESULT_36379893750.md). Legacy vendor is not this experiment's reference.

Change only the main movegen traversal's visited-cost AHashMap to 4,800 u32 slots initialized to the existing sentinel 40. Index includes x, y, rotation and spin; piece is fixed per traversal. Assert anchor bounds before indexing. Preserve queue insertion/order, costs, landing map, sorting, air-prefix builder, DAG, evaluator, node budget and all rule transforms. The dense table uses 19,200 bytes per active movegen invocation; initialization cost is part of measurement.

Correctness gates, before interpreting performance:

- Exhaustive slot uniqueness, sentinel/update and heap sequence comparison against the hash helper.
- Existing 43 ordered movegen fixtures with exact placements/spins/costs (full traversal reference; accepted air compression already passed this same comparison).
- Existing combined authority gates: 2,038 checks, then 96 multi-placement trace checks; zero differences required.
- Clean release WASM without observers; pinned Rust 1.90.0 and lockfile wasm-bindgen.
- Real Chromium Worker: the same 12 detached public snapshots used for profiling, 200,000 nodes, three passes, alternating module order. Compare the entire report for every pair, not merely top-1; authority validates both recommendations. Raw reports and any failure retained.

Predeclared performance gate: average the two warm timings per state, compute candidate/reference reductions, require the median paired reduction to be at least 10% and no state's mean more than 10% slower. First pass is reported but excluded from this gate. This is a finite performance screen, not statistical proof of all-device speedup. Record memory, hashes, browser version and timings. Identical-artifact local smoke validates harness only, not this hypothesis.

One finite Actions job, 45-minute technical watchdog. Notification on success or failure to the authorized ntfy topic. Performance threshold failure is a recorded rejection, not a correctness failure. No arena, parameter tuning, vendor replacement or automatic promotion. Review the result before adopting or changing the experiment.

Local preflight: reconstructed accepted movegen from its recorded patch, verified exact transform anchors and unchanged original helper/air builder; duplicate transformation is rejected. Twelve existing JS authority/adapter tests passed. Identical accepted WASM on both arms passed 12 full-report pairs and 24 top-1 authority checks (16 placement, 8 Hold) in Chromium Worker at 2,000 nodes. That smoke run tests the harness only. Rust compilation, dense candidate parity and real speed measurements remain for Actions.
