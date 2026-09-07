# Phase 1 review handoff

## Phase 1.1 correction log

- Issue #2: seed creation now uses Python-compatible nonnegative modulo, mapping
  zero residues to 2147483646. All safe integer seeds are accepted; noninteger
  and unsafe Number inputs remain rejected. Boundary seeds and 150 pulls per
  seed are compared against the independent Python normalization/queue/RNG oracle.

Status: implemented for the documented TL/standard-piece subset; the scoped
exit criteria below pass. Stop here for review. Phase 2 has not started.

## Exit criteria

| Criterion | Evidence | Result |
| --- | --- | --- |
| Imported fixture tests pass | All 11 JSON files are imported by tests/runtime; behavioral vectors run against engine operations. Finesse is schema-only, explicitly excluded from stats compatibility. | PASS for the declared coverage |
| Relevant reference comparisons pass | All five supplied Python models compared to JavaScript; no skips | PASS |
| Same seed/rules/inputs produce byte-equivalent canonical state | Independent engines compared after every frame of a 160-frame input/garbage run | PASS |
| Save/restore does not change future covered behavior | Restored at each frame, including between same-frame inputs; future queue, garbage travel, RNG and piece state compared | PASS |
| Architecture and unknowns documented | This report and README | PASS |

This is conformance to the supplied behavioral material, not proof of complete
production-client equivalence. No official client bundle was used as an oracle.

## Architecture

- `src/board.js`: material grid, hard storage bounds, ceil-Y occupancy, pivot
  translation, line removal, insertion and one-row live-piece repair. No cache
  means there is no stale legality across board/piece changes.
- `src/random.js`: Park–Miller states, shuffled 7-bag with prefill, independent
  garbage-hole stream and packet-depletion consumption.
- `src/physics.js`: the errata's exact epsilon/probe, gravity-lock, soft-drop,
  anti-stall and kick-base formulas.
- `src/rotation.js`: ordered SRS+ candidates and spin classification from
  fixture tables. Mini remains distinct for base attack but counts as a
  recognized spin for B2B and garbage-special bonus.
- `src/rules.js`: resolved configuration with explicit unsupported-option
  errors; tested solo metadata and Blitz numerical formulas.
- `src/attack.js`: ordered surge/ordinary/AC offence, two cancellation budgets,
  packet queues, capped tanking and acknowledgement reconciliation.
- `src/engine.js`: spawn/hold/initial actions, fractional input timeline,
  handling, fall/lock/placement transaction, typed waits and canonical state.

Runtime modules contain no filesystem, clock, network, browser UI, randomness
from the platform, or Python calls. The only platform arithmetic is JavaScript
Number/Math. Tables are specification data, not official runtime code.

The checkpoint is sorted-key JSON with an explicit schema tag. It includes
board materials, full pre-generated bag, both RNG states, input accumulators,
pending initial actions, falling-piece counters/flags, rules/handling, gravity
lock, combo/B2B, packet and acknowledgement queues, waits, scores and lifecycle.
It also includes current-frame inputs/cursor so a mid-frame restore cannot
replay already-consumed input. Diagnostics and rendering metadata are excluded.

## Test matrix

Validation on Node.js 24.15.0 and the bundled Python 3 runtime on Windows:
**293 tests passed, 0 failed, 0 skipped**, including verification of every supplied
handoff file against the corrected archive's SHA256 manifest.

| Area | Imported data / independent evidence | Coverage |
| --- | --- | --- |
| Board/materials | Board core JSON + BoardReference | Bounds, ceil probes, gbd, all empty predicates, clear/insert/repair invariants; 40 mixed-material oracle boards |
| Pieces | Standard pieces JSON | All 7 types x 4 orientations; pivot/commit/collision |
| Bag | SevenBag Python | 20 seeds x 150 pulls; each queue, bag id and RNG checkpoint |
| Rotation/spin | SRS+ and spin-rule JSON | Every standard JLSTZ/I transition; ordered fallback geometry, O no-kick, T corners, all modes on standard types |
| Fall | Exact precision JSON + fall Python | Every supplied vector; 600 cross-language cases; probe collision, gravity lock and soft-drop call splitting |
| Input/handling | Input-frame JSON | All six vectors; DAS/ARR=0, DCD at spawn, opposing inputs, repeat suppression |
| Lifecycle | Prose scenarios | Empty/full hold, tap/hold IHS before IRS, direct/ARE blockout difference, clutch, lockout, 20G, reset threshold, safelock |
| Placement | Placement-order JSON | All five vectors, real board mutation, immediate/deferred tank, separate AC cancellation |
| Attack/garbage | TL rules JSON + updated TL Python | 300 mixed placements plus travel/growth; minis, opener, hardened, cap, surge, AC, acknowledgement traffic |
| Hole RNG | Hole Python | Four seeds, mixed tank/cancel packet boundaries; explicit columns and partial packets |
| Solo numerical data | Solo presets + Blitz level JSON | Both preset records, all 30 level thresholds/gravity values and natural-20G gating |
| Finesse | Finesse JSON | Domain/schema validation only; no claim of implemented finesse accounting |
| Canonical restore | Independent reruns + mutation/error tests | Sorted bytes, no shared references, frame/input cursor, future garbage and RNG, explicit malformed errors |

These references deliberately do not model the entire engine. Passing their
subsystem comparisons cannot validate interactions they do not represent.

## Unknown and unsupported boundaries

1. **Solo placement policy:** the handoff gives launcher overrides but not all
   inherited solo attack/B2B/scoring options. `mode: '40l'`/`'blitz'` supports
   preset/physics inspection; `lock()` fails explicitly before board mutation.
   Do not use those modes as complete game presets yet.
2. **Nonzero line-clear ARE:** visual timing consumes `rngex`, but its jitter
   formula is not supplied. Such rules are rejected. Ordinary positive ARE with
   instant/delayed tanking is implemented and tested.
3. **Finesse stats:** no documented conversion from destination X to the supplied
   table's 11 indices, nor complete special soft-drop accounting. The table is
   retained and validated; finesse faults/combos are not synthesized.
4. Exotic piece types appearing in supplemental kick/spin tables have no supplied
   standard geometry. They are outside the seven-piece runtime domain.
5. Nonzero garbage phase, queued-garbage progression, weighted messiness,
   nonzero passthrough modes, nonunit receive/cancel multipliers, absolute caps,
   target bonuses, infinite-movement variants and nonzero cap growth are unsupported.
6. No official connected-skin edge bytes or render actors are canonical. No
   renderer is present; gameplay occupancy is independent of those visual fields.
7. No private coordinator, FFA policy, KO attribution, stock/revive, Zenith,
   unsafe callbacks, hesitated/animated attacks or online replay verifier.
8. Score tables are implemented for covered TL placements; exact aggregate/finesse
   and visual-stat parity has no independent reference. No cross-browser
   byte-equivalence claim is made for transcendental Math operations.
9. The supplied notes describe move and rotational reset domains but do not
   include a complete reset-accounting oracle. Boundary tests cover the stated
   limits and new-low reset; official frame-by-frame comparison remains future work.

## Proposed Phase 2 interface (design only)

The parser should own file/schema validation and translate supported replay data
to a resolved ruleset, integer seed, frame input arrays and semantic interaction
events. It should not mutate gameplay rules to make a mismatching replay appear
valid.

Suggested boundary:

```ts
type EngineCheckpoint = string; // versioned canonical JSON, not replay `full`
type Input = {
  frame: number;
  subframe: number;
  type: 'keydown' | 'keyup';
  key: 'moveLeft' | 'moveRight' | 'rotateCW' | 'rotateCCW' |
       'rotate180' | 'softDrop' | 'hardDrop' | 'hold';
  hoisted?: boolean;
};

// Future parser/reconstruction adapter, not implemented:
// parseReplay(bytes) -> supported schema, immutable source, rounds/players
// inputsAtFrame(round, player, frame) -> Input[] in stored order
// seekFrame / seekPlacement -> EngineCheckpoint + source cursor
// forkState(checkpoint) -> Engine.restore(checkpoint)
```

Store semantic interaction/confirmation cursor alongside the engine checkpoint.
Use the engine's typed wait stage for travel/ARE; do not infer packet maturity
from a visual garbage counter. Preserve replay `full` separately: it lacks RNG
and queue fields required for this engine's restore contract.

Do not implement this adapter, replay viewer or bots until the Phase 1 review.
