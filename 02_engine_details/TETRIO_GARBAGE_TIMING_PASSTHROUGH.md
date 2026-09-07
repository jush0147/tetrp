# TETR.IO Garbage Timing, Blocking, Messiness, and Passthrough

Source examined: production client bundle from `01_Official_Standalone`, engine version 19.

This document focuses on implementation details that are easy to lose in high-level wiki descriptions.

## 1. Garbage is a packet queue, not a single integer

Incoming garbage is stored in `impendingdamage` as packet objects. A packet can carry fields including:

- `id`: local garbage packet id
- `cid`: optional client-side correlation id
- `iid`: interaction id from the sender
- `ackiid`: sender acknowledgement watermark
- `gameid`: sender id
- `username`
- `amt`: number of lines remaining in this packet
- `active`: whether the packet may advance/tank
- `status`: `sleeping`, `caution`, `danger`, or `spawn`
- `delay`: packet phase duration, normally based on `garbagephase`
- `queued`: whether it must wait behind earlier packets
- `hardened`: whether normal attack may cancel it
- `shielded`: protected garbage that will not tank normally
- `column`: optional forced hole column
- `size`: garbage hole width
- rendering / actor metadata

This matters because two queues with the same total pending line count can behave very differently.

## 2. Travel time and phase time are separate

When an ordinary online attack is accepted by the client, `IncomingAttack()` schedules an `incoming-attack-hit` event after:

`garbagespeed` frames.

Default option value in the engine is 20 frames (~333 ms at 60 Hz), though online modes may override it.

At the hit event the packet becomes active and `ProcessGarbageStatus()` advances its status machine.

For a packet with `delay >= 1`, the normal status path is:

`caution -> caution -> danger -> spawn`

The first call establishes the first cycle, then another `delay` expires before `danger`, and another `delay` expires before `spawn`.

So, ignoring queue waiting, a packet may require approximately:

`garbagespeed + 2 * garbagephase`

frames from attack reception/flight scheduling to becoming spawn-eligible.

If `garbagephase == 0`, the packet may begin in `spawn` and only the travel time applies.

## 3. Queued garbage is serialized

If `garbagequeue` is enabled and there is already pending garbage, a new packet may enter as `sleeping`.

A sleeping queued packet does not begin its caution/danger countdown until it reaches the front of the queue. When a preceding queued packet is fully removed, `ProcessGarbageStatus()` is called on the next packet.

This means a later packet can be visually/persistently pending for much longer than its own configured delay.

## 4. Garbage only rises on a tank event

Becoming `spawn` does not by itself mean the line is immediately inserted into the board.

`TakeAllDamage()` is the routine that consumes spawn-eligible packets and converts them into actual garbage lines.

Normal calls consume at most:

`floor(min(garbagecap, garbagecapmax))`

lines per tank event.

The engine defaults are:

- `garbagecap = 8`
- `garbagecapmax = 40`

This cap is **not** the same as a cap on total pending garbage.

`garbageabsolutecap` is the separate setting that can cap total pending garbage during packet receipt.

`garbageattackcap` is yet another independent setting that caps outgoing attack produced by a line-clear event.

## 5. Combo blocking is literally implemented at lock/clear time

After a piece locks, `LineClearManager` decides whether the next action is allowed to tank garbage.

### `garbageblocking = "combo blocking"`

If the piece clears at least one line, or produces attack, the engine runs cancellation (`FightLines`) and reports that this placement blocked tanking.

Result: the placement does **not** immediately take remaining pending garbage.

Even a line clear with zero outgoing attack can therefore block garbage rise.

### `garbageblocking = "limited blocking"`

The engine still calls `FightLines()` so attack may cancel pending garbage, but it reports that the placement did not block tanking.

Result: any leftover spawn-eligible garbage may rise after the placement/ARE timing.

### `garbageblocking = "none"`

The attack is sent directly and does not perform normal pending-garbage cancellation here. The placement also does not block tanking.

This distinction is strategically important: cancellation and delaying garbage rise are separate mechanics.

## 6. ARE interacts with tank timing

When a placement is marked as needing to tank, the exact time of `TakeAllDamage()` depends on `ARE`, `lineclear_are`, and `garbageentry`.

For placements with an ARE wait, the waiting-frame handler can execute:

`TakeAllDamage()` -> spawn next piece

at the end of ARE.

The engine therefore deliberately orders garbage injection relative to piece spawn rather than treating it as a continuously applied background process.

## 7. Three garbage entry modes

`garbageentry` supports:

- `instant`
- `continuous`
- `delayed`

### instant

`TakeAllDamage()` immediately calls board `PushLine()` for each consumed line.

### delayed

Each consumed line schedules a future `push-garbage-line` event at:

`garbageare * (line_index + 1)`

frames.

### continuous

Consumed lines are placed into `garbageareentries`. `BoardManager.ProcessGarbageARE()` injects one eligible line at a time and then locks the next injection until:

`current_frame + garbageare`.

Continuous-entry lines remain cancellable by `FightLines()` before they are physically inserted, except hardened entries.

## 8. `garbagearebump` adds protection after a blocking clear

When the clear/attack path successfully blocks tanking, the engine updates:

`garbagearelockeduntil = max(current, frame + garbagearebump)`

Default `garbagearebump` is 12 frames.

This mainly affects continuous garbage entry by pushing the next permitted rise farther into the future.

## 9. Hardened garbage bypasses ordinary cancellation

Both pending packets and continuous-entry garbage can carry `hardened`.

`FightLines()` explicitly skips hardened entries rather than consuming them with outgoing attack.

Thus the raw pending-line count is not sufficient to know defensive power: cancelable and hardened garbage behave differently.

## 10. Messiness has two distinct probabilities

The engine uses at least two separate notions of messiness:

### `messiness_inner`

When taking individual lines from a packet, this is the probability of selecting/rerolling a new hole column inside the packet.

Conceptually:

`if no previous hole OR RNG < messiness_inner: choose a new column`

So this controls within-packet hole changes.

### `messiness_change`

When a packet is fully exhausted/removed, this is the probability of rerolling the column for the next packet.

It is also consulted when a packet disappears via cancellation.

So this controls boundary-to-boundary hole changes.

These are not interchangeable settings.

## 11. Additional hole-generation controls

### `messiness_nosame`

When rerolling, exclude the immediately previous hole column.

### `messiness_center`

Restrict candidate holes away from the outer ~20% of board columns. On a 10-wide board, the implementation effectively excludes the two columns on either edge from ordinary selection.

### `garbageholesize`

Controls hole width; board insertion supports multiple adjacent hole cells.

### `garbagefavor`

When nonzero, hole selection is no longer uniform. The engine ranks candidate columns using stack geometry and distance from the most recent garbage hole, then applies a bias over that ranking.

The internal candidate score includes roughly:

`column stack height + 5 * distance_from_previous_garbage_hole + small_rng_tiebreak`

The sign/magnitude of `garbagefavor` controls which end of this ranking is weighted more heavily.

This is more sophisticated than simply "random hole with X% messiness".

## 12. Passthrough prevention uses interaction acknowledgements

For `passthrough = "zero"` and `passthrough = "consistent"`, the client maintains per-opponent ledgers:

- outgoing: `{ iid, amt }` records for attacks sent but not yet fully resolved
- incoming: highest interaction id observed from that opponent

Outgoing interaction messages carry both:

- a new interaction `iid`
- an `ackiid` representing the latest incoming interaction seen from that target

When new garbage arrives from an opponent, the client first compares it against its own still-unacknowledged outgoing attacks to that same opponent. It subtracts crossing amounts before adding the remainder to `impendingdamage`.

In practical terms, simultaneous attacks can cancel **in flight**, before either side sees the full raw amount as pending garbage.

This is why a naïve simulator that only does:

`my attack -> my pending cancellation -> send remainder`

is incomplete for zero/consistent passthrough modes.

### `zero` vs `consistent`

The core acknowledgement/cross-cancel path is shared for both modes in this client bundle. `consistent` additionally has user-facing exchange feedback when outgoing attack overlaps an attack still in transit.

The exact distinction for `limited` and `full` is not fully recoverable from this client path alone; those values do not use this acknowledgement branch here and may rely on server-side interaction policy. This is a clear boundary where server source would be needed before claiming full reconstruction.

## 13. Spike UI is not the same as board damage

`AnnounceOffensive()` accumulates `lastoffensive.offence` into a spike counter and keeps a short 60-frame spike window for UI/effects.

That displayed spike can include attack that was generated across multiple clears. It does not directly mean the opponent's board rose by that amount.

The path is closer to:

`generated attack -> local cancellation -> in-flight passthrough cancellation -> remote pending packets -> packet delays/queue -> garbage cap -> actual tank -> board lines`

Every arrow can reduce, delay, or restructure what the player eventually receives.

## 14. Practical macro consequence

Two attacks with the same nominal total can have radically different lethality because of:

- whether they arrive as one packet or several
- whether packets are sleeping/caution/danger/spawn
- whether the defender clears a line before tanking
- whether outgoing attack cancels them locally
- whether cross-fire is removed in flight by passthrough acknowledgement
- current garbage cap
- garbage entry mode and ARE lockout
- messiness / hole continuity
- hardened status

So "20 attack" is not a complete state description. Timing and packet structure are part of the game state.
