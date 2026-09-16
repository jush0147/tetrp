# Phase 2 handoff: replay parsing and deterministic reconstruction

Base: `main` at `d2ee449`. Phase 2 is complete for the supported profiles below,
with conformance differences and one unsupported player stream explicitly recorded.
No viewer, bot, network client, or production code integration was started.

## Supported variants and provenance

- JSON container version 1 `.ttr`, `gamemode: 40l`, gameplay version 15:
  **v19 client's v15 replay compatibility behavior**, not a claim of implementing
  the complete historical v15 binary.
- JSON container version 1 `.ttrm`, `gamemode: league`, gameplay version 19,
  single-opponent streams. Round and player indices are zero-based.
- Source events: start, full, keydown/up, end, and IGE target, allow_targeting,
  garbage interaction and interaction_confirm. Original source-array order,
  including equal/decreasing input subframes within a frame, is preserved.
- Unknown event types, input keys, gameplay options, unsupported mode/version
  combinations, non-unit garbage size, and non-neutral unsupported features fail
  explicitly. Frame regression is an error, never an invitation to sort.
- `retryisclear=true` is unsupported. Ordinary solo retry is a terminal action,
  not RNG reset. Multiplayer retry remains unsupported pending its applicability
  rule; it is recognized by the parser and never silently ignored.

Implementation uses user-supplied behavioral facts and the existing independent
Engine. No private production bundle or research tree was fetched or added.
The samples stayed in Downloads; derived validation output is in ignored
`.private-replays/phase2-validation.json`. That report contains seed/identity-
correlatable evidence and stays private. Public tests use original synthetic data.
No commit, upload, or publication was performed.

## Engine correction, separately justified

Direct v19 evidence supplied by the user resolves Phase 1 issue #4. A successful
rotation now increments ordinary `piece.resets` as well as `rotationResets` and
`totalRotations`. A successful horizontal move increments ordinary resets.
New-low descent clears the first two counters, not total rotations.

Regression tests cover the fifteenth grounded rotation forcing lock, mixed
move/rotation quota exhaustion, failed operations, distinct rotational counters,
new-low resets, anti-stall and excessive-rotation kick behavior. This is the only
engine behavior changed in Phase 2. It was authorized from direct behavioral
facts before the real-file comparison; subsequent anchor mismatches were not fixed
by changing rules. Old Phase 1 checkpoints retain the same storage format but
must not be used as evidence for the superseded rotation behavior.

## Adapter decisions

`anchorseed` does not affect simulation. `no_szo` rotates the first bag's leading
S/Z/O pieces to its tail without drawing RNG. Existing `spawn()` / `pullBag()`
then refill to at least 14 pieces before shifting. Engine construction's initial
bag is replaced only by this **seed-derived initialization**, never by an anchor.
The independent garbage RNG is unchanged.

The initial full is a pre-spawn observation. Its board, first bag, hold, gravity
and known counters are compared with seed-derived pre-spawn state; its placeholder
falling record is not treated as an active I piece. Later full states and terminal
states are observations, never checkpoint restores or state corrections.

Persisted IGE executes at the outer replay frame and original source position.
Both nested frames are retained for correlation and never cause another defer.
IGE IDs suppress duplicates; duplicate entries remain explicit metadata.
The single opposing game ID is normalized to Engine's P2 ledger identity.
Remote cid maps to the local ID returned by `receive()`, with that mapping included
in reconstruction checkpoints. Fully cancelled packets make confirms harmless.
Confirmation invokes existing Engine travel scheduling at execution frame + 20.

End is an external terminal lifecycle action (sleep/stop), followed by comparison.
An already established Engine failure reason is preserved, so a different replay
end reason is reported rather than overwritten. Sleep/playing set by that external
lifecycle are not independent proof of engine correctness. End falling is the
current piece, including a possibly newly spawned piece, with untransformed raw Y.

## Real-file validation and accuracy

`40L.ttr`: 1 round, 1 player, 577 source events. Reconstructed **100 placements,
40 lines**; all available terminal projected counters match. This file contains
no intermediate or terminal board snapshot: **40L board accuracy is not externally
verified**. Solo aggregate score/B2B/attack remain unknown and are not compared.

`TL.ttrm`: 10 rounds, 20 player streams, 17,834 source events. All parse and can be
selected. **19 streams reconstruct**, and all 19 match the terminal board, complete
exported NEXT queue, active piece position/orientation/raw Y, lines and placements.
All 19 initial pre-spawn projections match. **15/19** streams match every projected
terminal field; four differ as recorded below. Round 6 / player 1 is unsupported
because source event 4 is multiplayer retry; it was not skipped to manufacture
an end-to-end success.

For each executable stream, the private audit checks every reconstructed placement
(including position zero) against a forward-run canonical-state fingerprint,
seeks to it twice, and forks independent Engines that accept local input. It also
checks checkpoint continuation at initial/middle/final placement, three frame
positions, and between first receive and confirmation for each TL stream.
Restored continuations match full canonical Engine bytes and first diagnostics.
Across the 20 executable streams (solo plus 19 TL), this covers **2,396 placements,
4,832 placement seeks and 2,416 local forks**, including initial positions.
This proves deterministic self-consistency; sparse anchors do not prove every
intermediate placement matches the source game.

Projected fields include board rows, full bag queue, hold, gravity, lines/holds/
pieces/level/levelLines, TL score/combo/B2B, terminal reason, and piece type, x, raw
Y, rotation, historical low, kick, keys, safelock, locking, ordinary/rotation reset
counters, wall/sleep/force-lock/soft-drop flags and spin classification.
Unobserved RNG state, totalRotations, internal pending queues/waits, DAS/ARR timers,
input history, unsupported stats and unmapped presentation flags are not claimed
as externally verified. These remain in the deterministic Engine checkpoint.

## First observed divergences

Indices below are zero-based source-array indices; placement is the Engine's
number of completed placements. Expected values are replay anchors, actual values
are reconstructed canonical state. **Every row has `firstDivergentFrame = null`**:
only pre-spawn and sparse terminal anchors are available.

| Round/player | First observed frame | Source event | Placement | Canonical field | Expected | Actual |
| --- | ---: | ---: | ---: | --- | --- | --- |
| 1 / 1 | 3478 | 1697 | 225 | `stats.score` | 54153 | 53903 |
| 2 / 1 | 945 | 509 | 69 | `reason` | topout | garbagesmash |
| 2 / 1 | 945 | 509 | 69 | `stats.holds` | 25 | 26 |
| 2 / 1 | 945 | 509 | 69 | `hold.piece` | i | j |
| 2 / 1 | 945 | 509 | 69 | `hold.locked` | false | true |
| 3 / 0 | 1558 | 726 | 98 | `piece.kick` | 1 | 0 |
| 9 / 1 | 1500 | 831 | 107 | `piece.kick` | 1 | 0 |

Candidate investigations, not additional corrections:

- Round 2 / player 1, source event 508, frame 945 is a hold. Immediately before it,
  reconstructed hold is i/unlocked with 25 holds. The event spawns I and terminates;
  Engine subsequently records j/locked and 26 holds. End exports i/unlocked and 25.
  Investigate terminal export/hold transaction ordering and topout classification.
- The two kick mismatches follow hard drops at events 725 and 830 respectively,
  spawning a new piece that immediately terminates. The previous piece has kick 1;
  Engine resets new piece kick to 0, while the end anchor retains 1. Investigate
  reset order around terminal spawn. This does not establish a live kick-rule error.
- Score differs by 250 despite matching terminal board/positions and TL combo/B2B.
  No dense score anchors establish which scoring transaction first diverged.

No denser truth is inferred from matching final boards. Diagnostics preserve the
last matching partial observation but do not describe it as a fully validated
checkpoint or a proof that all earlier frames match.

## Stable API for a future Phase 3 consumer

Runtime is native ESM with no filesystem, rendering, bot or network dependency.
Import from `src/replay/index.js`:

```js
const replay = parseReplay(jsonText);
const player = selectPlayer(replay, 0, 0);
const sourceEvents = orderedEvents(player);
const timeline = prepareReplay(player); // explicit profile errors
const session = new Reconstruction(timeline);
const state = session.seekPlacement(20);
const checkpoint = session.checkpoint();
const restored = Reconstruction.restore(checkpoint);
restored.run();
const divergence = restored.diagnostics.first;
const local = session.fork();
if (local.state.phase === 'inputs') local.finishFrame();
local.step([{ frame: local.state.frame, subframe: 0,
  type: 'keydown', key: 'moveLeft' }]);
```

| API | Boundary / ownership contract |
| --- | --- |
| `parseReplay(text)` | Immutable container, indexed rounds/players, retained options/results; text only |
| `selectPlayer(doc, round, player)` | Zero-based; out-of-range error |
| `orderedEvents(player)` | Immutable lossless-order event envelopes with original `sourceIndex` |
| `prepareReplay(player)` | Seed-derived Engine initial state plus canonical timeline; never adopts full snapshots |
| `Reconstruction(timeline)` | Owns copied timeline, Engine, cursor, packet map and diagnostics |
| `state` | Detached copy of full canonical Engine state |
| `advance()` | One source action/observation or one frame boundary; false at end |
| `seekFrame(n)` | Start of n, before that frame's source events; accepts 0 through `frames` |
| `seekPlacement(n)` | After the atomic Engine operation producing placement n; 0 is initial; may be mid-frame |
| `checkpoint()` / `restore(bytes)` | Self-contained timeline, Engine state, cursor, remote/local IDs and diagnostics |
| `fork()` | Independent Engine, no remaining replay events; use existing local input APIs |
| `run()` | Consume the timeline including terminal events and anchors |
| `compareFields(actual, expected)` | Exact recursive partial comparison; canonical paths with expected/actual values |
| `DivergenceDiagnostics.observe()` | First observed frame, source index, placement, differing fields and uncertainty |
| `projectAnchor(data, options)` | Explicit partial projection; never synthesizes missing RNG/totalRotations |
| `decodeFlags(flags)` | Canonical subset of supported v19 flags; rejects non-15-bit input |

Timeline schema `tetrp-timeline/1`: `id`, `frames`, serialized ready/frame-zero
`initial`, and ordered `events`; prepared profiles also retain `profile`/`options`.
Canonical event types: keydown/up, receive, confirm, anchor, metadata, terminal,
and generic end annotation. Raw start/target/duplicate events remain metadata;
raw end produces terminal then anchor at the same source index. Generic end is
an annotation, not an implicit terminal action. Prespawn anchor comparison uses
an independently computed `actual`; all gameplay anchors observe Engine state.

Checkpoint schema is `tetrp-reconstruction/1`, containing `tetrp-engine/2`.
Checkpoints include private replay metadata and must remain private. No index into
an external replay is required for restore. A terminal Engine remains terminal;
fork does not revive a topped-out board or clear the objective. Live mid-frame
forks can call `input(localEvent)` before `finishFrame()`; the replay cursor and
remaining source events are not carried into the local Engine.

Seek currently replays from initial state (linear time); there is no viewer cache
or rendering layer. If one atomic Engine operation produces multiple placements,
seeking an interior placement explicitly throws `PLACEMENT_BOUNDARY`. All validated
real placements are individually reachable. Source `frames` is the available
frame bound; events at that boundary are consumed by `run()`, whereas `seekFrame`
stops before them.

Sparse observations set `firstObservedFrame` and leave `firstDivergentFrame` null.
Direct callers of `observe(..., {exact: true})` may assert an independently proven
exact boundary; the replay adapter never infers this flag from an end mismatch.
An empty expected projection proves nothing. Unsupported fields must not be
filled with defaults to manufacture a match.
Missing canonical fields are reported as `{ "$missing": true }`, so diagnostics
retain that distinction across JSON checkpoints; observed values are detached
from mutable Engine state.

## Checks and remaining limits

- Full suite: **325 passed, 0 failed, 0 skipped**, Node 24.15.0 on Windows with
  bundled Python. Includes existing reference/provenance audits, corrected engine
  regressions and synthetic adapter/checkpoint/diagnostic coverage.
- Private audit: `node scripts/validate-replays.mjs <40L path> <TL path>
  --output .private-replays/phase2-validation.json`.
- Structural inspection: `node scripts/inspect-replays.mjs <private paths>`.
- `git diff --check` and tracked replay-extension check complete before handoff.

Remaining work is evidence-driven engine conformance investigation for the four
streams, multiplayer retry applicability, denser independent anchors for exact
first-frame localization, and unsupported replay modes/features. Phase 2 does not
claim universal TETR.IO compatibility or complete historical v15 emulation.
Stop here; Phase 3 viewer and bot integration have not begun.

## Provisional TL retry no-op — requested by the user (2026-09-16)

At the user's explicit request, all TL `retry` keydown/keyup events are treated as no-ops, including mid-round events, any subframe, and absent/false/true `hoisted`. This is a provisional compatibility assumption, not confirmed general TETR.IO behavior, and has NOT been broadly tested. The user explicitly requested inclusion of mid-round retries. Solo retry and retryisclear profile handling are unchanged. Each event remains in source order as `provisional-ignored-multiplayer-retry` metadata, including original fields and source index. Engine rules and anchor values are unchanged. This note is only in code/documentation; no provisional notice is added to the viewer UI.

The single real case checked is TL.ttrm, displayed Round 7 / VEXSERY (zero-based round 6 / player 1), source event 4. Ignoring that event reconstructs 124 placements and 62 lines through frame 1842. Both available anchors (pre-spawn and terminal source event 952) match every projected field, including terminal board, Hold, Next, active piece, attack and counters. Repeated seeks and checkpoint continuation at placements 0 / 62 / 124 match. Sparse anchors do not establish every intermediate frame: firstDivergentFrame remains null and no precise divergence is inferred. This supersedes the earlier unsupported status for this one sample; the original findings above describe the pre-exception baseline.

Mid-round TL retry behavior has synthetic no-op/order coverage only; real-sample evidence is limited to the opening retry described above.
