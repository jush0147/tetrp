# Arena execution correctness review

Status: correctness fixtures pass; one new GitHub Actions FT7 is authorized after
the workflow correctness gate. Evaluator changes and ablations remain paused. The historical 7–3 is invalid as
policy-strength evidence. The corrected physical demonstration is also not a
result of the new placement model.

## Actual policy contract

Legacy WASM emits `kiwi-snapshot-result/3`, with `action` and ranked
`candidates[].action`. A place contains `placement.location` with CC2 piece,
orientation and bottom-up x/y, plus `placement.spin`. Hold is a standalone
`kind: hold` with mode and same-piece information.

The Tetrp adapter produces this authority-coordinate action (Native produces
the same shape directly):

```js
{
  action: {kind: 'place'},
  move: {piece, x, y, rotation, useHold: false, cells},
  execution: {moves, spin},
  candidateIndex: 0
}
// or
{
  action: {kind: 'hold', mode: 'empty' /* or occupied */,
    samePiece, requiresReanalysis: true},
  move: null
}
```

Tetrp's `y`/cells use occupied rows (`ceil`); the proof preserves fractional y
internally. Raw CC2 coordinates/orientation are not numerically interchangeable
with authority coordinates. Legacy normalization verifies the raw landing's
occupied cells/spin, retains the raw action as `policyIntent`, and expresses
the reached pose in Tetrp coordinates. Symmetric-piece representations can
differ while denoting the same occupied cells. Once normalized, x/y/rotation
as well as cells are checked exactly; no substitution is permitted.

## Previous path and discovered fallback layers

Legacy: public snapshot -> root allowlist -> WASM ranked actions ->
`normalizeRankedRecommendation` -> `findCurrentPath` -> normalized action.
Native supplies a geometric witness directly. Both then went through a timed
input compiler, a public Engine probe, and the real private Engine's inputs.

There were TWO fallback layers: Legacy normalization skipped invalid ranked
entries, and arena transport validation selected a later candidate. The vendor
`schedulePath` originally checked lock instant/count, not final pose/spin;
the outer arena detected those mismatches but changed the policy action.
The subsequent `schedulePlacement` repair improved physical transport, but
did not remove this architectural coupling.

`findCurrentPath` is geometry BFS, not a timed-input proof. Its witness includes
translations, unit descents, rotations and a final hard drop. Spin is earned
on a rotation with kick/provenance, and preserved by the final hard drop.
It must not be inferred afresh from final occupied cells.

## What depends on intermediate timing

* Gravity / 20G, DAS/ARR/SDF and collisions determine reachable physical paths.
* Natural descent or translation can clear spin; rotation counters affect
  SRS+ kick Y; lock/reset exhaustion and anti-stall can auto-lock early.
* `safelock`, sleeping pieces, ARE, IRS/IHS and held keys can alter whether a
  hard drop/Hold is accepted and how the next piece spawns.
* Nonzero ARE and continuous `attack.are` garbage can change the board during
  the cadence, repair/move the active piece or cause garbage-smash KO. An old
  geometric certificate would then be invalid.
* Packet confirmation waits, cancellation ledgers, garbage activation and
  attack multiplier depend on the world clock. Lock frame determines which
  packets can tank and which multiplier the attack uses.
* Input/drop score and key counts can differ across physical paths. These are
  not strength-arena win criteria.

Once the supported board is stable until lock, final placement + earned spin +
lock frame + actual authority state suffice for the existing lock transaction:
line clear, combo, B2B, Surge, opener defense, cancellation, All Clear, garbage
tanking, lockout, spawn and clutch. These are all retained in `Engine.lock()`;
there is no new attack or garbage implementation.

## Implemented bounded placement model

Default arena model: `tl-placement-v1`. Physical demonstration model:
`physical-input-v1`. Results must not be pooled across models.

`PlacementArenaEngine` inherits Engine. It replaces active input/gravity/auto-lock
control (including automatic 20G grounding), not transaction rules. A piece waits
at its decision pose until its assigned lock instant. World frames, waits,
garbage acknowledgements/travel and multiplier growth continue through the
original `beginFrame` / `finishFrame` methods. This is intentionally a macro-action
policy environment, not a claim of exact equivalence to real-time TETR.IO play.

Current supported lifecycle is TL, zero ARE/line-clear ARE/garbage ARE/bump,
instant garbage entry, ordinary one-use Hold, no timed objective and no continuous
ARE garbage. Unsupported rules/queues fail closed. The default arena preset
satisfies these restrictions. In-flight garbage may activate while waiting, but
under this preset it changes the board only in the authoritative lock transaction.

1. Capture both public snapshots before either policy runs. Give policies detached
   copies; retain immutable decision inputs for validation/dumps.
2. Read exactly the original top-1. Legacy uses `normalizeTopRecommendation`:
   rank zero normalization failure throws; no attempt to normalize rank one.
3. Validate the supplied witness from actual active pose using authority
   `move`, `descend`, `rotate` and `slam(true)`, without elapsed physical time.
   Every operation must succeed. Check piece/x/y/rotation/cells/spin and grounding.
4. Issue a private certificate bound to board, active pose, Hold, rules and
   placement count. Retain every step's before/after provenance, including kick,
   rotated flag and rotation counters. Derive expected cleared rows, garbage
   rows and All Clear with existing pure board logic.
5. At frame `start + 23`, subframe `.5`, recheck certificate binding, install
   only its validated final piece, and call the inherited `Engine.lock()`.
   No arbitrary external `(x,y,r,spin)` is accepted by commit.
6. Audit actual lock and clear even when the transaction causes KO. Send both
   sides' generated packets at the next frame barrier, as before.

Certificates are private, single-use and cannot be reconstructed from an external
JSON object. A changed board/pose/rules/Hold invalidates them. Unsupported dynamic
geometry is a technical failure, never a reason to choose another candidate.

## Hold and parity

Hold is validated separately and executed by `Engine.hold()` without consuming a
placement period. Compare current pose, held piece/lock, known queue prefix,
board, frame, playing/reason, Hold count and unchanged attack state. Empty Hold
reveals a new fifth preview only AFTER submission; the pre-Hold check compares
the four previews that were already known. Reanalyze the fresh snapshot before
placement. Repeated/locked Hold is a technical failure.

Every committed placement must match top-1 piece, x, canonical occupied-row y,
rotation, all four occupied cells, earned spin, lock frame/subframe and derived
clear result. Policy schema does not contain a clear prediction: that expectation
is derived independently by the authority from the submitted intent.

Failure dumps in `result.failures[]` (also emitted as `technical-failure`) include
public snapshot, raw/normalized policy intent, validated witness/provenance when
available, stage/error and actual authority view/result. FT7 result persistence
therefore persists these dumps. No actual hidden sequence/RNG is fed back to bots.

All technical failures are unscored, including bounded diagnostics. A capped
diagnostic and simultaneous KO do not acquire half-points in paired reports.
`parity` reports audited placements, Holds and mismatches per policy. A 100% gate
means every accepted action was audited with zero mismatches; it does not assert
that every future bot output will be valid. Invalid outputs stop the game as
technical failures.

## Transport and replay boundaries

Viewer/Bot Mode retains the physical input compiler and its own candidate UX.
Future live/TBP integration must define its own physical budget and handling.
SDF 40x/instant are physical settings, not requirements for placement legality.
Correctness tests verify SDF 6, 40 and 41 (the Engine's instant sentinel) produce
identical placement-model results. No assumptions about a player's settings are
required by the strength arena.

The existing `.ttrm` exporter is an input-event recording and now explicitly
rejects placement-model recordings. `kiwi:replay` is labeled a physical-input
demonstration, not a strength run. A future action replay must preserve the new
execution contract; synthesizing keys afterward must never change match results.
No new replay format or viewer rewrite is included in this change.

## Validation

Tests cover the real Legacy T-spin witness; exact physical/direct transaction
comparison where both are executable; pose/spin/cell forgery; stale/reused proof;
no-fallback lazy ranked results and Legacy normalization; empty/occupied/same-piece
Hold; active-pose freezing with live garbage activation/multiplier growth;
unsupported continuous garbage/ARE; SDF independence; Surge/All Clear/cancellation
phase order; terminal lockout and post-clear clutch. Bounded A/A fixtures audit
each executed action without reporting a strength score.

Real Native and Legacy rank-zero outputs were separately checked on empty and
Legacy regression snapshots; all four matched, and both selected full-spin
single clears on the regression. Local evidence: `.cache/placement-intent-audit.json`.
No new FT7 or strength experiment was run during this review.
