# Rotation diagnostic: current-height domain

2026-09-27. Follow-up to [run 36293876659](RESULT_36293876659.md).

## Decision

Do not expand the CC2 pose representation solely to fix the 186 synthetic integer-height probes. Source inspection supports noninteger current.y as an invariant of ordinary default TL Engine-generated lineage. The new finite tests support that argument; they are not exhaustive reachability proof or Rust parity certification.

Do not silently normalize arbitrary PublicSnapshot/checkpoint heights either. Engine.restore accepts finite integer y. Same occupied cells do not imply identical rotation behavior. Before production integration, the adapter must either explicitly reject unsupported external poses or represent them faithfully. No guard or production behavior was changed in this audit.

## Writer audit

| Path | Height behavior |
| --- | --- |
| Engine.spawn, including Hold | buffer - 2.04, normally 17.96 |
| Engine.descend, gravity, soft drop, slam | fallProbes rounds to micro precision and adds 0.000001 if the candidate is integer |
| rotationCandidates raw rotation | Retains y |
| kickY before rotation-history threshold | floor(y) + 0.1 + integer kick |
| kickY after threshold | Retains fractional part, adds integer kick |
| blockout clutch / board.repairAfterGarbage | Subtracts whole rows; failed clutch restores original y |
| Engine.restore | Accepts arbitrary finite y; does not establish generated lineage |
| prepareReplay | Constructs Engine and spawns; full-state anchors become observations |
| Reconstruction | Restores timeline.initial; anchors only compare. A caller-supplied initial checkpoint can therefore inject integer y |
| Placement authority publicProbe | Copies snapshot.current, so inherits its domain |
| Placement certificate / commit | Witness uses Engine move/rotate/descend/slam; commit copies certified finalPiece. Does not convert intent's ceil(y) into active y |

For ordinary 40-row TL storage magnitudes, the generated fractional distances from an integer are large enough that adding/subtracting these small whole-row offsets does not round them to an integer. Arbitrarily large custom geometry, manually modified state, and externally authored checkpoints are outside this argument. This is an invariant argument about height, not a claim that every noninteger pose or arbitrary rotation-history combination is reachable.

## Reproducible evidence

`node --test test/kiwi-height-domain.test.js test/replay.test.js`: 21/21 passed.

Related regression including physics, rotation, placement-authority and CC2 movegen audit tests: 232/232 passed. No production source changed.

The five new tests cover:

- Bounded numeric sweep: rows -4 through 44; six fractional residues including one micro-unit from either side; nine descent steps, rotation counts 0/30/31/63, five kicks and 81 whole-row shifts.
- 28 seeds with actual 40 successful rotations, movement, Hold, fractional descent, slam, collision-triggered garbage repair, restore and hard drop. Counters are produced by operations, not assigned.
- 28 frame-input trajectories (14 seeds × SDF 40/41), subframe input and automatic lock/spawn, at most 360 frames each.
- Reconstruction with an intentionally conflicting integer-height anchor: no pose injection; checkpoint and fork preserve generated height.
- Accepted external checkpoints at I x1, y38 versus y37.96: starting cells identical, actual Engine clockwise-rotation cells differ.

Clutch preservation is source-reviewed here, not newly established by an end-to-end naturally occurring clutch trajectory. The direct-operation test is geometry/state-domain coverage, not proof of 24-frame physical execution.

## Implication for the preceding run

All 186 Rust/authority mismatches and all 10 authority certificate discrepancies were conditional integer-height probes. They remain recorded. This audit supplies no example that normal generated lineage reaches that exact-height domain. It does not establish complete movegen/spin correctness or permit a new FT7.

Next: produce rotation/kick/180 fixtures from spawn-reachable authority paths, retaining full path and actual rotation history. Compare both full-reference and air-cache Rust implementations; separate arbitrary-pose compatibility failures from generated-lineage failures. Keep the existing 43-case movegen regression. No evaluator change, no production WASM replacement.
