# Engine behavior contract

This is project-facing documentation for the implemented v19 behavioral subset.
It is not client source, a replay wire specification, or a promise of complete
production equivalence. Unresolved boundaries are in PHASE_1_HANDOFF.md.

## Coordinates and pieces

Default storage is 10 columns by 40 rows: 20 hidden, 20 visible. Every position
outside storage is occupied. Occupancy and commit use `ceil(y)`. Materials are
null, a piece letter, ordinary garbage `gb`, or permanent garbage `gbd`.
Only full rows without `gbd` clear. Removal prepends empty rows; insertion drops
the top row. Garbage repair of an active piece tries at most one row upward.

`src/data/pieces.json` contains pivot coordinates and four ordered sets of four
xy cells per piece. Projection preserves `piece.x + x - pivotX` and
`piece.y + y - pivotY`, including arithmetic order. There is no skin, preview,
connectivity or per-mino metadata. `kicks.json` contains only JLSTZ and I ordered
fallbacks; pure rotation is tried first, O never kicks. `spins.json` covers only
the seven supported types. T corners, facing corners, kick promotion and
immobility distinguish none/mini/full spins. Recognized minis count for TL B2B
and garbage-special bonuses while retaining mini-specific base attacks.

## Randomness

Seeds are safe integer Numbers, normalized with nonnegative modulo 2147483647;
zero residues become 2147483646. This matches the independent Python models for
zero, negative and out-of-range integers. Reject noninteger and unsafe inputs.
Each draw multiplies the live state by 16807 modulo 2147483647; floating output
is `(state - 1) / 2147483646`. Bag and garbage streams are independent.

Fisher–Yates starts from `z,l,o,s,i,j,t`. Setup generates one bag; each pull
prefills to at least 14 before removing the first piece. Hole generation retains
probability-zero inner draws and probability-one completion draws. Whole-packet
cancellation consumes the completion hook; partial cancellation does not.

## Frame and lifecycle

A step represents 1/60 second. Consume same-frame inputs in stored order;
floor subframes to tenths. Advance horizontal handling and fall before each
later timestamp. Equal/decreasing timestamps do not rewind. Increment source
frame before finishing the remaining segment, then run typed waits and
continuous garbage. Equal-target waits run latest first and match exact frames.

Default handling is ARR 2, DAS 10, DCD 2, SDF 6, tap IRS/IHS, safelock enabled.
Immediate horizontal presses move once; internal repeats follow DAS/ARR.
ARR 0 repeats up to board width. Last direction wins; wall DCD observes the
outgoing piece before spawn state is replaced. Spawn is at x=4/y=17.96 on the
default board. Hold swaps without consuming the queue when nonempty; IHS takes
precedence over IRS. Direct spawn checks collision before buffered actions;
ARE spawn resolves them first. A preceding line clear can permit upward clutch
search; lockout and spawn/garbage blockout remain distinct.

## Exact fall formulas

Internal candidate: round `(y + step)` to six decimals, then add `1e-6` if integral.
Second probe: `y + 1`, subtracting `2e-6` if integral. Both must be legal.
Consume budget in chunks no larger than one cell, stopping on an illegal step.
Gravity lock samples g unchanged if its countdown is <=0, scales by
`(1 - glock/180)^2` for 0<glock<=180, and yields zero above 180; then decrement
the positive countdown by dt. Finite soft drop uses
`max(effectiveG * dt * SDF, 0.05 * SDF)`, with the floor per call, not per frame.
SDF 41 uses `400 * dt`. Force-lock budget replacement is 20 when grounded and
the ordinary reset quota is exhausted. Anti-stall then adds
`0.5 * dt * max(0, rotationResets - lockresets - 15)`.

Lock time uses strict `>30` by default. Natural locking sets safelock to 7;
every Fall invocation decrements it once, independent of dt. Row crossings
invalidate retained spin except during hard drop. Known soft/hard drop points
are one per crossed row and two per successful internal drop cell respectively.
Direct v19 behavioral evidence supplied for Phase 2 corrects ordinary reset
accounting: successful moves and successful rotations each increment `resets`.
Rotations also increment `rotationResets` (capped at 63) and `totalRotations`.
Failed actions consume neither quota. A genuinely lower `ceil(y) > hy` clears
`resets` and `rotationResets`, while retaining `totalRotations`. The ordinary
quota controls force-lock; the rotation counters serve anti-stall and kick Y-base
selection respectively. See the Phase 2 report for real replay evidence limits.

## Placement and modes

Shared placement: mark sleeping/count piece, commit, detect/count/remove lines,
update counters, apply supported mode policy, lockout, progression, ARE/spawn.
TL policy is isolated: surge precedes ordinary attack, All Clear is a separate
attack/cancellation phase, then decide tanking. Any clear blocks combo-mode
tanking. Cancellation spends real attack before opener defense and consumes ARE
entries before pending packets, skipping hardened entries. Active spawn-eligible
packets tank up to the cap (default 8), not a global pending limit. Confirmation
schedules 20-frame travel. Zero passthrough maintains peer acknowledgement ledgers.
The independent TL model tests exact arithmetic and transaction ordering.

40L uses the shared transaction and the 40-line objective. Blitz also updates
level progress by repeatedly subtracting `ceil(level * 0.42 * 5)` and updates
gravity to `(1/60) / max(1e-9, 0.65 - (level-1)*0.007) ** (level-1)`.
Natural 20G is disabled for Blitz; the 120000 ms objective is evaluated per frame.
Solo aggregate score, B2B and attack are unknown: checkpoint them as unknown/null,
never as a fabricated zero score. Board reconstruction continues. Known drop
points are separate in `stats.dropScore`. Solo garbage APIs remain unsupported.

## Checkpoints

Sorted-key JSON schema `tetrp-engine/2` contains board, queue, both RNG states,
falling/input/reset counters, handling/rules, timers, progression, waits, TL
packet/acknowledgement state, and explicit conformance markers. Current-frame
input cursor and unconsumed events are included. Future frames are caller-owned.
Version 1 is rejected; it did not represent the new solo aggregate boundary.
Diagnostic traces and renderer state are not checkpoint authority.
