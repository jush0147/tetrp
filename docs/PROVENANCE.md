# Public/private provenance review — issue #5

This audit classifies every artifact from the previously published handoff tree.
Categories: **1** runtime-required data; **2** conformance-required material;
**3** useful behavior rewritten as implementation-facing docs; **4** raw research,
unused metadata or provenance material excluded from this public revision.

The inputs were user-supplied behavioral documents and small independent Python
models. They were not official client source. The public implementation remains
independent and MIT-licensed. Retained test models are explicitly attributed to
the supplied independent behavioral models; they are not newly discovered oracles.

## Artifact inventory

| Former artifact | Category | Public disposition |
| --- | --- | --- |
| `01_core_spec/TETRIO_CLEANROOM_ENGINE_SPEC_V19.md` | 3 + 4 | Required behavior rewritten in ENGINE_SPEC; raw research framing removed |
| `01_core_spec/TETRIO_RECONSTRUCTION_READINESS_V19.md` | 4 | Research readiness assessment; removed |
| `02_engine_details/TETRIO_BAG_HOLD_SPAWN_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_BOARD_COLLISION_MUTATION_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_CLUTCH_TOPOUT_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_COORDINATE_COLLISION_PRECISION_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_EVENT_SCHEDULER_FRAME_ORDER_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_FALL_SOFTDROP_ANTISTALL_EXACT_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_FRAME_INPUT_ORDER_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_GARBAGE_TIMING_PASSTHROUGH.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_HANDLING_PHYSICS.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_PLACEMENT_TRANSITION_ORDER_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_SCORING_ATTACK_FORMULAS.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_SOLO_40L_BLITZ_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_SPIN_CLASSIFICATION_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_STATE_SERIALIZATION_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_TETRA_LEAGUE_EDGE_CASES.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `02_engine_details/TETRIO_TL_GARBAGE_HOLE_RNG_V19.md` | 3 + 4 | Implemented behavioral contract rewritten in docs/ENGINE_SPEC.md; raw source-level narrative and unsupported research details removed |
| `03_fixtures/TETRIO_BLITZ_LEVEL_TABLE_V19.json` | 2 | `test/fixtures/blitz.json`; behavior values retained, unused input-event prose removed |
| `03_fixtures/TETRIO_BOARD_CORE_TEST_VECTORS_V19.json` | 2 | `test/fixtures/board.json`; behavior values retained, unused input-event prose removed |
| `03_fixtures/TETRIO_FALL_SOFTDROP_ANTISTALL_TEST_VECTORS_V19.json` | 2 | `test/fixtures/fall.json`; behavior values retained, unused input-event prose removed |
| `03_fixtures/TETRIO_FINESSE_TABLE_V19.json` | 4 | Unused table and schema-only test removed; finesse remains unknown |
| `03_fixtures/TETRIO_INPUT_FRAME_TEST_VECTORS_V19.json` | 2 | `test/fixtures/input.json`; behavior values retained, unused input-event prose removed |
| `03_fixtures/TETRIO_PLACEMENT_ORDER_TEST_VECTORS_V19.json` | 2 | `test/fixtures/placement.json`; behavior values retained, unused input-event prose removed |
| `03_fixtures/TETRIO_SOLO_MODE_PRESETS_V19.json` | 1 + 4 | `src/data/solo.json` — Used mode overrides only; launcher metadata and unused options removed |
| `03_fixtures/TETRIO_SPIN_RULE_TABLES_V19.json` | 1 + 4 | `src/data/spins.json` — Seven-piece eligibility and corner tests; unused mini-eligibility metadata removed |
| `03_fixtures/TETRIO_SRSPLUS_KICKS_V19.json` | 1 + 4 | `src/data/kicks.json` — JLSTZ/I only; unused exotic tables/overrides removed |
| `03_fixtures/TETRIO_STANDARD_PIECES_V19.json` | 1 + 4 | `src/data/pieces.json` — Only pivots and 112 xy cells; previews, dimensions and per-mino metadata removed |
| `03_fixtures/TETRIO_TETRA_LEAGUE_V19_RULESET.json` | 1 + 4 | `src/data/tl.json` — Flattened behavioral values; match/room presentation metadata and source narrative removed |
| `04_reference/tetrio_bag_reference.py` | 2 + 4 | `test/reference/bag_reference.py`; independent algorithms preserved, research prose and unused demos removed |
| `04_reference/tetrio_board_reference.py` | 2 + 4 | `test/reference/board_reference.py`; independent algorithms preserved, research prose and unused demos removed |
| `04_reference/tetrio_fall_precision_reference.py` | 2 + 4 | `test/reference/fall_precision_reference.py`; independent algorithms preserved, research prose and unused demos removed |
| `04_reference/tetrio_tl_hole_reference.py` | 2 + 4 | `test/reference/tl_hole_reference.py`; independent algorithms preserved, research prose and unused demos removed |
| `04_reference/tetrio_tl_v19_reference.py` | 2 + 4 | `test/reference/tl_v19_reference.py`; independent algorithms preserved, research prose and unused demos removed |
| `05_phase2_replay/README_PHASE2.md` | 4 | Future-phase research/wire material removed; no parser work undertaken |
| `05_phase2_replay/TETRIO_DETERMINISM_RNG.md` | 4 | Future-phase research/wire material removed; no parser work undertaken |
| `05_phase2_replay/TETRIO_REPLAY_WIRE_PROTOCOL.md` | 4 | Future-phase research/wire material removed; no parser work undertaken |

The former root README_FOR_CODEX, ROADMAP_FOR_CODEX, ERRATA_FOR_CODEX and
SHA256SUMS were also removed (categories 3/4). Project purpose/gate/behavior
corrections now live in README, ENGINE_SPEC and PHASE_1_HANDOFF. The original
archive manifest remains local, not a dependency of public tests.

## Proof of behavior preservation

- Runtime values were projected from the old tables before removal and frozen
  in `test/fixtures/data-contract.json`. The ten retained data files are hash checked.
- Every standard piece retains its pivot, four rotations and four xy cells.
  Projection arithmetic order is unchanged. A pre-cleanup digest checks 1120
  type/rotation/x/y combinations, including fractional and epsilon boundaries.
- JLSTZ and I kick ordering is retained exactly. Seven-piece spin eligibility
  and corner values are retained. Tests reject extra exotic tables and metadata.
- The five Python models retain the same normalized executable AST as before
  cleanup, excluding docstrings/comments and unused self-tests/demo entry points.
  Algorithms were not translated from JavaScript or replaced with engine output.
  Python 3.12 is used for the reproducible AST audit. All five cross-language
  comparison domains still execute independently.
- Deleting the unused finesse schema test does not remove a behavioral test:
  it previously established only array shape, not runtime conformance.
- `test/provenance.test.js` checks the tracked tree for forbidden research paths
  and asset/archive files. A clean checkout needs neither private files nor ZIPs.

These fingerprints are review locks for the current behavioral contract, not
evidence of licensing status or production equivalence. Changes to fixtures
or models require a documented behavioral reason and corresponding test review.

## Historical publication limitation

The research tree had already been pushed in commit `36cd8c9` and inherited by
the original Phase 1 branch. This correction removes it from the new revision;
it does not make previously public history private. Until this review is merged,
the base branch also retains the old tree. Existing GitHub commit/PR references
may remain accessible even after branch deletion or a history rewrite.
No force push, remote branch deletion or automatic merge was performed. A
repository-wide historical cleanup requires a separately approved plan, including
the impact on existing review references and any host-side cached objects.
The ignored local copy is only a preservation measure, not a reversal of prior
publication. Do not describe this revision as having erased the earlier exposure.
