# Combined corrected model: integration gate

2026-09-27. Pinned kiwi-v1 source, isolated diagnostic only. No production/evaluator change.

Apply, in order: lock timing, pending queue scan, 40-bit storage, failed-insertion debit order and observer hooks; mid-descent movegen; explicit empty-Hold lineage/spawn guard; snapshot Hold observer; air-prefix cache. The existing historical workflows remain available. New workflow: `kiwi-cc2-combined-audit.yml`.

The final source tree is built with `cc2_air_prefix` for transaction, lifecycle and snapshot binaries. Lifecycle and snapshot suites are rerun after adding the cache, not only before. The spawn reference arm has the same four transaction corrections but no spawn guard, so paired regression continues to isolate the spawn intervention.

Required gates:

- 72 actual GameState/Forecast transitions against certified authority placements.
- Six failed-insertion boundaries, including pending preservation and terminal no-op tests.
- 141 lifecycle cases, zero corrected mismatches and unchanged previously passing outputs.
- 30 standalone Hold/reanalysis requests with eight hidden-tail pairs.
- 1746 rotation probes, zero differences between authority/reference/candidate.
- 43 complete placement/spin/cost regressions.
- Forecast, spawn and original snapshot Rust tests with the final cache configuration.

The final manifest records source hashes, per-suite summaries and the combined source diff. A single combined summary is written only after every gate passes; partial artifacts are uploaded on failure and ntfy reports the outcome.

Local verification: regenerated 72 authority fixtures and six primitive boundary expectations. Rust compile and integrated behavior await Actions. This is a composability check across finite suites, not yet a many-placement public-prefix authority trace or DAG selection-replay/stored-child equivalence proof. Those are the next milestone; neither FT7 nor production promotion follows automatically.
