# Dense candidate: eight parallel KO integration legs

Follow-up to [36380902069](RESULT_36380902069.md). User approved continuation and requested more efficient Actions use; expanded from two legs to eight concurrent legs after explicit feedback that two was too slow.

Use the exact dense WASM from run 36380902069 (SHA256 `bd21800742a8d5abd54118cb51f458fb987d8f6c4f5e6cd940b12ae4deafa6ba`). No compile, evaluator, search-budget, authority or transport changes. Opponent is the Tetrp vendored Kiwi snapshot-v3.2, not upstream CC2.

- Four seed pairs, legs 0–7. Both seats share the piece seed; swap policies for each paired leg. Existing batch seed protocol: 2026100001 + pair * 100, with retries +4. These overlap prior regression seeds deliberately; this is correctness coverage, not a new held-out strength experiment.
- Eight independent standard Ubuntu jobs; max-parallel 8, no repeated workflow or scheduled load. Each leg reuses the pinned build artifact.
- 200,000 nodes/request; 24 frames/placement for both policies; PublicSnapshot only; Tetrp placement authority; top-1 only and zero fallback.
- Each leg ends only at a scored KO. Simultaneous KO does not score and retries with a new seed. At most 25 attempts; technical failure aborts the leg.
- No gameplay frame cap. Existing 360,000-frame watchdog and 120-minute step/130-minute job limits are technical limits, never winner adjudication.
- Preserve full snapshots/actions/certificates/authority results in JSONL. Validate piece/cells/spin/clear/lock through existing authority parity; runner verifies Hold reanalysis snapshots. Aggregate rejects missing/duplicate legs, wrong artifact/seed/cadence, technical faults, fallback or mismatches; require incoming-garbage and Hold coverage for both policies.
- Always upload partial artifacts, retain traces seven days, aggregate once and send ntfy on success or failure. No automatic production deployment or further arena dispatch.

This increases throughput and coverage, not individual game speed. Four paired seeds are not a strength promotion criterion. Official Actions terms permit repository-related application testing; the documented Free standard-runner concurrency ceiling is 20, shared account-wide. Eight is a workload choice within that ceiling, not a guarantee about account scheduling or blanket approval for unlimited usage.

Sources checked: https://docs.github.com/en/actions/reference/limits and https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features .
