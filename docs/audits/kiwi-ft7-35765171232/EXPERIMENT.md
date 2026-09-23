# Geometry budget experiment registration

Registered before execution, 2026-09-23. No evaluator or search-rule changes.

- Control: Native geometryBudget 100000 vs unchanged Legacy.
- Candidate: Native geometryBudget 1000000 vs unchanged Legacy.
- One FT7 per arm. Both use base seed 2026092401 and the existing identical
  per-attempt piece/hole seed schedule, alternating seats each attempt.
- Same 24 frames/placement, snapshot-only, authority KO only, no ordinary frame
  cap, unscored double KO, stop on technical failure, strict top-1 parity.
- All other profile settings are identical. Search wall time does not change
  placement cadence. Production/browser defaults stay unchanged.
- FT7 stopping means arms can have different lengths; only common attempt
  indices are directly seed/seat matched. This is a small controlled pilot,
  not a fully balanced fixed-game tournament or promotion-level evidence.
- Primary outcome: KO wins/losses. APP, timing and depth are diagnostic only.
- No follow-on tuning or automatic promotion. Inspect correctness before
  interpreting score. Do not choose new seeds based on these results.
- Actions runtime timeout is infrastructure failure, never a gameplay loss.
- Each arm preserves complete/partial artifacts and sends an ntfy notification
  to the user-requested topic, including budget, seed, score and run link.

The workflow intentionally runs independently of the agent; results will be
reviewed when the user returns. A subsequent old-Native head-to-head comparison
is not part of this initial two-arm pilot.
