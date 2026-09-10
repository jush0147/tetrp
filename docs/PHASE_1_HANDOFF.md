# Phase 1.1 correction handoff

Historical report. The Phase 2 direct v19 evidence supersedes issue #4's unknown
below: successful rotations **do** increment the ordinary reset quota. Engine and
regression tests are corrected; see [Phase 2](PHASE_2_HANDOFF.md). The rest of this
document records what was known at the Phase 1 handoff.

Scope: corrections for issues #2–#5 on `codex/phase-1-engine`. Stop for review
after validation. No Phase 2 parser, UI, bot, PWA or deployment is included.
This report supersedes the original Phase 1 completeness claims.

## Corrections and traceability

| Issue | Change | Regression evidence |
| --- | --- | --- |
| #2 | Match Python nonnegative modulo and zero-residue normalization for all safe integer seeds | `test/reference.test.js`: zero, -1, -MOD, MOD, MOD+1, normal positives, ±safe-integer extrema; initial RNG and 150 bag pulls/checkpoints per seed |
| #3 | Keep shared lock/commit/clear/counters/progression/spawn independent of TL offence and unknown solo aggregates | `test/solo.test.js`: 12 seeded placements per solo mode with live continuation, clear, hold and repeated restore; 40L completion, Blitz level/gravity/timed objective |
| #4 | Preserve existing reset interpretation; make its uncertainty explicit | `test/lock-accounting.test.js`: grounded moves, rotations, mixed actions, new-low reset, force-lock, anti-stall and actual kick-base boundary |
| #5 | Replace the raw research tree with minimal runtime data, behavioral test fixtures, test-only models and project docs | `test/provenance.test.js` and reference AST audit: projected data hashes, 1120 geometry cases, table-domain restrictions, tracked-tree exclusion, unchanged oracle algorithms |

Issue-specific commits preserve reviewability; the hygiene change relocates data
and removes source narrative without redesigning the engine. Details of each
removed artifact are in [PROVENANCE.md](PROVENANCE.md).

## Conformance claims changed

- Seeds outside the Park–Miller state range now normalize correctly, including
  negatives. Noninteger/unsafe Number seeds remain rejected. Restored live RNG
  checkpoints must still contain valid normalized states.
- 40L and Blitz can now reconstruct board placements across many pieces. Solo
  aggregate `stats.score` and `attack` are null. `conformance.aggregateScore`,
  `conformance.attack` and `conformance.b2b` explicitly say `unknown`. Known drop
  points accumulate separately in `stats.dropScore`; this is not a total score.
- TL attack/garbage/scoring follows its existing isolated transaction and all
  reference comparisons continue to run. Solo placements do not enter it;
  unsupported solo garbage input fails explicitly instead of guessing policy.
  TL policy keys retained in the shared rules object are inactive in solo and
  must not be interpreted as recovered solo defaults; the conformance markers
  and null attack state are authoritative about this limitation.
- Checkpoints use `tetrp-engine/2`; v1 is rejected instead of inventing a migration
  for state that did not encode the solo aggregate boundary. Mid-frame remaining
  input/cursor, both RNG streams, board, timers and progression are preserved.
- Reset tests establish the current interpretation, not production correctness.
- No claim of conformance comes from validating an unused extracted table. The
  finesse schema-only test and unused finesse data were removed. Required data
  are now checked by behavioral tests and frozen projection contracts.

## Architecture

The architecture remains small: `board.js` owns occupancy/mutation, `random.js`
owns deterministic streams, `physics.js` owns exact numerical formulas,
`rotation.js` handles ordered kicks/spins, `rules.js` resolves supported options,
`attack.js` implements TL arithmetic/packet bookkeeping, and `engine.js` sequences
frames and placements. The new `resolveTLPlacement` method isolates the previous
TL-only block. Shared placement and the existing Blitz progression loop remain
in `lock()`; there is no new parser or general mode framework.

Runtime imports only five JSON tables in `src/data`. Python and filesystem/Git
calls are test-only. Diagnostics/render state are excluded from canonical state.
[ENGINE_SPEC.md](ENGINE_SPEC.md) describes the public behavioral contract.

## Validation matrix

The final validation command is `npm test` with Python 3.12 available (or `PYTHON`
set). Every test runs; no skip or swallowed failure is permitted. Local and CI
results are reported with the review revision.

Local full suite and clean checkout: **309 passed, 0 failed, 0 skipped** on Node
24.15.0 and Python 3.12.14 (Windows), including the repository-index hygiene audit.
The clean checkout has no private handoff backup. GitHub Actions is checked
before handing the revision back; its result is linked in the review report.

| Domain | Cases / evidence |
| --- | --- |
| Seeds/bags | 20 existing seeds × 150 pulls plus 12 normalization cases × 150 pulls; independent Python initial and evolved states |
| Board | 40 mixed-material oracle boards, bounds/epsilon probes, mutation and garbage-repair cases |
| Geometry/kicks/spins | All 7 types × 4 rotations; every standard kick transition; all supported spin modes; 1120 old/new projection cases |
| Precision | Every retained exact fall vector; 600 Python formula combinations; gravity lock and soft-drop call boundaries |
| Input/placement | All six input vectors and five placement-order vectors; actual commit/clear/tank/spawn transitions |
| TL and garbage holes | 300 mixed reference placements plus travel/growth/acknowledgements; four seeds with tank/cancel boundaries |
| Solo | Both modes stay live through 12 seeded placements and repeated restore; real seeded continuations start from a synthetic one-line well; objective/level tests use explicitly constructed checkpoints |
| Reset interpretation | Six focused scenario tests, with no speculative quota change |
| Serialization | Per-frame and between-input restore, sorted bytes, no shared references, null unknown markers and malformed checkpoint rejection |
| Hygiene | Ten projected data files, five normalized oracle ASTs, geometry boundary digest, allowed public file/table domains |

Tests cover the declared behavioral subset. No real `.ttr` files or official
runtime were used. Deterministic self-consistency is not evidence of matching
an external replay, and an oracle comparison cannot validate behavior that the
oracle does not model.

## Issue #4: reset-accounting boundary

Current interpretation, intentionally unchanged:

| Operation | Effect |
| --- | --- |
| Successful horizontal move | Increment `piece.resets`, reset `locking` |
| Successful rotation | Reset `locking`; increment `rotationResets` capped at 63 and `totalRotations`; do not increment `resets` |
| Failed move/rotation | Do not consume these counters |
| New `ceil(y) > hy` | Clear `resets` and `rotationResets`; retain `totalRotations` |
| Grounded `resets >= lockresets` | Force-lock on Fall |
| `rotationResets > lockresets + 15` | Extra fall budget `0.5 * dt * excess` |
| `totalRotations > lockresets + 15` | Switch kicked Y base from floor(Y)+0.1 to Y |

Whether rotations must also consume the ordinary reset quota is still unknown.
Future replay differential validation must locate the first differing frame and
compare all three counters, Y/hy, locking and forceLock. That validation requires
representative replay evidence; this pass implements neither parsing nor a
replay divergence tool.

## Remaining unknowns and limitations

- Solo aggregate score/B2B/attack, exact aggregate/finesse stats and unprovided
  inherited solo policies remain unknown. These no longer block board placement.
- Nonzero line-clear ARE remains unsupported because its RNG jitter is unspecified.
  Ordinary positive ARE with instant/delayed TL tanking is tested.
- Nonzero garbage phases, queued progression, weighted messiness, nonzero
  passthrough, nonunit multipliers, absolute caps, target bonuses, infinite
  movement, cap growth and exotic piece types remain unsupported.
- No renderer/connectivity bytes, private coordinator, FFA, revive/Zenith,
  online verifier, unsafe callbacks or animated/hesitated attacks are modeled.
- Cross-browser equality for transcendental Math operations has not been tested.
- **Publication boundary:** this revision removes the research tree, but prior
  commits and the unmerged base branch still expose its earlier publication.
  This correction does not erase Git history or force-push other branches.
  Repository-wide historical removal is a separate approval/review decision.

## Public/private boundary and review gate

The public revision needs no handoff ZIP or private research paths to build or
test. The raw originals remain in ignored local storage for provenance checks;
they are not runtime or CI dependencies. The five retained independent models
are behavioral test oracles, not official client code. No official bundle,
beautified source, font, sound or visual asset was introduced.

After review, a future adapter may translate supported replay input into rules,
seed, ordered per-frame inputs and semantic garbage events, retaining its own
source cursor alongside engine checkpoints. Replay display anchors must not be
treated as complete RNG checkpoints. This is an interface boundary only.

Stop at Phase 1.1 for review. Do not start Phase 2 or merge automatically.
