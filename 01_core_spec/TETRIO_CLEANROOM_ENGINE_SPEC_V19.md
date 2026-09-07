# Clean-room implementation spec: TETR.IO-like engine, v19 reference

Purpose: preserve the behavior already recovered from the official production client while keeping a future implementation independent from the bundled/minified TETR.IO client code.

This is a behavioral specification, not copied source.

## 1. Deterministic core

Use a fixed 60 Hz simulation timeline.

Input events retain subframe ordering at 0.1 frame precision. Browser/OS key-repeat is not authoritative; DAS/ARR is simulated internally.

Maintain two independent deterministic PRNG streams:

```text
rng   -> bag/piece sequencing
rngex -> garbage holes, messiness, stochastic rounding, auxiliary gameplay RNG
```

A full state save used for deterministic restoration must preserve both PRNG states. A visual/replay synchronization anchor that omits RNG state is not a complete deterministic checkpoint.

## 2. Recommended module boundaries

```text
GameState
Constants / Ruleset
Board
Bag
FallingPiece
Input / Handling
LineClear
Attack / Garbage
Targeting
Replay / EventStream
StateIO
Renderer (separate from simulation)
```

Renderer code must never be the source of gameplay truth.

## 3. Piece/handling requirements already recovered

Implement and differential-test:

- SRS+ including the actual I-piece table and 180 transitions
- DAS / ARR / DCD
- DAS preservation behavior
- IRS tap/hold
- IHS tap/hold
- soft drop and infinity SDF behavior
- hard drop
- true 20G path
- 30F default lock delay
- 15 lock resets
- separate movement/rotation reset accounting
- safelock
- spawn/hold/rotation ordering
- clutch rescue behavior
- no-lockout vs blockout distinction
- finesse counters/tables if compatibility requires stats parity

## 4. Per-frame high-level ordering

The official client loop establishes this broad order:

```text
pull event stream
advance frame
process held horizontal shift (DAS/ARR)
fall/gravity
process interrupt/input actions
execute waiting-frame events
execute unsafe waiting-frame events
process continuous garbage ARE
check objectives
update spike/attack/auxiliary systems
grow gravity after gmargin
grow garbage multiplier after garbagemargin
grow garbage cap after garbagecapmargin
update targeting/actors/etc.
push replay full-anchor when due
```

The growth operations occur late in the frame. An implementation that applies the new garbage multiplier before the clear occurring in that same frame can differ at timing boundaries.

## 5. Current built-in Tetra League v19 reference values

Important explicit values:

```text
bag                 7-bag
spinbonuses         all-mini+
allow180            true
kickset             SRS+
next                5
g                    0.02
gincrease            0.0035 / second after 7200F
garbagemultiplier   1
garbageincrease     0.008 / second after 10800F
garbagespeed        20F
garbagecap          8
garbagecapincrease  0
garbageblocking     combo blocking
passthrough          zero
openerphase          14
b2bchaining          false
b2bcharging          true
b2bcharge_at         4
b2bcharge_base       0
combotable           multiplier
allclear_garbage     5
allclear_b2b         1
roundmode            down
garbagespecialbonus true
clutch               true
nolockout            true
```

Inherited TL-relevant defaults include:

```text
garbagephase         0
garbagequeue         false
garbageentry         instant
garbageabsolutecap   0
garbageattackcap     0
receivemultiplier    1
cancelmultiplier     1
messiness_change     1
messiness_inner      0
```

## 6. Line-clear/B2B/attack ordering

For a lock, preserve this logical ordering:

```text
find full lines
count how many cleared rows contain garbage
remove lines
check All Clear
classify full/mini spin
update combo
compute B2B contribution
    +1 for All Clear in current TL
    +1 for Quad-or-higher clear
    +1 for a recognized Spin line clear (mini or normal/full; the general spin bit is set for both)
if contribution > 0:
    increment B2B state
else if a line was cleared:
    release B2B Charge/Surge first (if charged)
    reset B2B
compute ordinary clear attack
apply fixed +1 B2B attack bonus when applicable
apply combo multiplier/floor
apply garbage multiplier
floor (TL roundmode=down)
apply +1 garbage-special bonus if qualifying
FightLines(ordinary attack)
then process separate All Clear attack (5 * multiplier, floored)
decide whether placement blocks tanking
if not blocked and TL zero-ARE conditions apply:
    TakeAllDamage()
```

Important: Surge packets are processed through `FightLines()` BEFORE the breaking clear's ordinary attack.

## 7. Combo blocking

For current TL:

```text
blocked_this_placement = (linesCleared > 0 OR generatedAttack > 0)
```

Because any ordinary line clear has `linesCleared > 0`, even a zero-attack Single blocks garbage rise for that placement.

A no-clear placement is tank-eligible.

Do not conflate cancellation with blocking.

## 8. B2B Charge/Surge

When a line clear breaks a chain and raw B2B state is greater than 4:

```text
surge = floor((btb - 4 + 0) * garbageMultiplier)
q = JS_MathRound(surge / 3)
packets = [q, q, surge - 2q]
```

Process each nonzero packet independently through `FightLines()`.

Then reset B2B state and continue computing the breaking clear's own ordinary attack.

No-clear placements do not break B2B.

## 9. All Clear is two concepts, not one bonus

Current TL uses:

```text
allclear_b2b = 1
allclear_garbage = 5
```

Therefore All Clear:

1. contributes to B2B state before normal clear attack is calculated;
2. later generates a separate 5-line attack path.

A Quad All Clear can contribute twice to raw B2B state: one contribution from All Clear and one from the Quad.

Do not flatten this into a single '+5 attack' modifier.

## 10. Opener protection

During first 14 placed pieces, if:

```text
pendingGarbage >= cumulativeGarbageSent
```

then `FightLines(A)` gains an additional defense-only budget A.

Cancellation spends real attack first and defense-only budget second.

The defense-only remainder can never become outgoing offence.

This can make an A=4 clear cancel up to 8 lines under the condition while still sending at most the unused portion of the original 4.

## 11. Garbage special bonus

After normal attack has been multiplied and rounded, add +1 when:

```text
at least one cleared row contained garbage
AND (linesCleared == 4 OR fullSpin == true)
```

Mini status alone does not satisfy the full-spin branch.

This means identical geometric attacks can differ by one depending on whether the clear actually downstacks garbage.

## 12. Garbage queues and tanking

Keep structured packets, not a scalar.

`FightLines()` cancellation priority:

```text
continuous garbage-ARE entries first
then impending packets
```

Skip hardened entries.

Cancellation does not require an impending packet to be active.

TL tanking:

- only active/spawn-equivalent packets tank;
- maximum 8 lines per normal `TakeAllDamage()` call;
- cap 8 is a per-tank injection cap, not a pending-queue limit;
- TL has no `garbageabsolutecap`.

## 13. Normal online garbage handshake

Preserve the two-stage model:

```text
interaction
  -> add inactive correlated packet to impending queue
  -> packet is already cancellable

interaction_confirm
  -> find by cid
  -> schedule 20F incoming travel

incoming-attack-hit
  -> active = true
  -> process status

later tank event
  -> board PushLine, capped at 8 in TL
```

The exact coordinator that creates confirmation events is server-side/private, but the consumer semantics are visible and reproducible.

## 14. Zero passthrough

Per opponent track:

```text
highest incoming iid
unacknowledged outgoing [{iid, amt}]
```

New outgoing attack includes the highest peer iid seen as `ackiid`.

When incoming attack arrives:

```text
remove outgoing records whose iid <= incoming.ackiid
cross-cancel incoming against remaining newer outgoing records
only remaining incoming becomes pending garbage
```

This reconciliation layer is distinct from `FightLines()`.

## 15. Topout compatibility notes

Current TL enables `clutch` and `nolockout`.

A spawn collision immediately after a line clear may be rescued by moving the spawned piece upward until legal. `nolockout` disables the normal post-lock high-position lockout check, but it does not mean the player can never top out: true spawn/blockout and garbage-smash failure paths remain.

## 16. Multiplayer authority boundary

Do not trust a visible player client to report attack values.

The recovered architecture strongly supports:

```text
client sends rolling input/replay stream
coordinator/headless simulation derives semantic interactions
server sends garbage/target/KO as authoritative IGE
remote clients replay scoped opponents through the same deterministic engine
```

For local 1v1, targeting can be constant and most public-service infrastructure can be omitted.

## 17. Differential validation strategy

Once a clean-room engine exists, compare it against the untouched official client bundle as a test oracle using identical:

```text
seed
ruleset
frame/subframe input events
```

At selected frames compare:

```text
board
bag/next
hold
falling x/y/rotation
lock timers/reset counters
DAS state
combo/B2B
attack/cancellation totals
pending garbage packets
RNG states (when using a full state extraction path)
```

The first divergent frame is far more useful than subjective "it feels close" testing.

## 18. Known private/uncertain boundary

Do not claim exact compatibility yet for:

- production Ribbon coordinator scheduling
- full FFA target-selection policy
- every non-zero passthrough mode
- official anti-cheat/replay verifier policy
- matchmaking/rating/account backend

Those are separate from the client gameplay mechanics and do not block a faithful standalone 40L/Blitz or local 1v1 engine.

## 19. Board geometry / collision invariants (confirmed)

Standard storage is `10 x 40`: 20 hidden buffer rows plus 20 visible rows.

Gameplay occupancy treats all coordinates outside storage as occupied and discretizes floating Y with `ceil(y)`. Piece lock uses the same `ceil(y)` mapping. This must remain consistent with the `-2.04` spawn offset and epsilon-adjusted falling logic.

Gameplay materials must distinguish at least:

```text
empty
ordinary colored mino
gb   ordinary garbage
gbd  unclearable/permanent garbage
```

A line is clearable only when every cell is non-empty and none are `gbd`.

See `TETRIO_BOARD_COLLISION_MUTATION_V19.md` and `TETRIO_BOARD_CORE_TEST_VECTORS_V19.json`.

## 20. Placement transition is an ordered transaction (confirmed)

The core placement order is:

```text
lock bookkeeping
-> commit active piece to board
-> detect/count/remove lines
-> ordinary scoring/attack/B2B/combo/surge/cancellation
-> All Clear as a second FightLines phase
-> decide immediate vs deferred garbage tanking
-> finesse / lockout / mode progression
-> ARE if configured
-> resolve deferred nextWillTank in ARE handler
-> spawn next piece
```

For current TL (`ARE=0`, `lineclear_are=0`, `combo blocking`):

- any actual line clear blocks tanking on that piece transition, even a zero-attack Single
- a no-clear placement can tank mature garbage before the next piece spawns
- no normal piece delay separates these operations

See `TETRIO_PLACEMENT_TRANSITION_ORDER_V19.md` and `TETRIO_PLACEMENT_ORDER_TEST_VECTORS_V19.json`.

## 21. Canonical checkpoint requirements (confirmed)

Do not use the periodic replay `full` event as the engine's canonical rollback state. It intentionally omits important future-determinism fields such as live PRNG seeds and full multiplayer/garbage bookkeeping.

The clean-room checkpoint should follow the richer `EjectState()` concept and include at minimum:

```text
frame + subframe
board/material state
bag + bag id
hold + hold lock
full falling-piece state
input held-state and DAS/ARR accumulators
handling
progression/gravity timers
combo/B2B state
incoming garbage + garbage-ARE queues
acknowledgement/passthrough ledger
attack/spike timers
rng seed
rngex seed
mode state that can alter future behavior
```

Renderer objects, audio objects and collision-cache entries are derived state and should be rebuilt after restore.

See `TETRIO_STATE_SERIALIZATION_V19.md` and `TETRIO_STATE_LAYERS_V19.json`.

## 22. Additional deterministic implementation leaks worth reproducing in oracle tests

Even when a cleaner implementation is used internally, differential tests should cover official-client quirks including:

- legality cache keyed without piece type and therefore aggressively invalidated
- `safelock` decremented per `Fall()` invocation rather than strictly per 60 Hz frame
- `rngex` calls that occur even for probability-zero garbage inner-messiness checks
- line-clear ARE visual jitter consuming `rngex` when enabled
- piece queue pre-generation causing bag RNG to advance beyond visible NEXT
- old-piece wall flags participating in DCD before spawn-state reset

These are not all desirable API designs. They are observable state-machine behavior and therefore useful compatibility tests.

## Final static-dissection additions

The final high-value pass also resolved:

- official 40 LINES and BLITZ launcher presets
- BLITZ level thresholds and exact gravity formula
- natural 20G special-path gating in BLITZ
- exact core frame-manager order
- EventStream Pull-before-AdvanceFrame semantics
- deterministic waiting-event execution stage
- LIFO tie-breaking for waiting events sharing a target frame
- distinction between deterministic typed waits and unsafe runtime callbacks

At this point, implementation plus differential testing is preferred over further static reverse engineering.
