# TETR.IO Tetra League edge-case mechanics

Reverse-engineered from the official production client bundle in `01_Official_Standalone` (engine version 19 in this package).

This file intentionally focuses on implementation details that are easy to miss if one only copies public rule summaries.

## 1. Effective Tetra League preset snapshot

The bundle contains a built-in `tetra league` preset with the following explicit values:

```text
match.gamemode       = versus
match.ft             = 7
match.wb             = 1
bagtype              = 7-bag
spinbonuses          = all-mini+
allow180             = true
kickset              = SRS+
nextcount            = 5
are                   = 0
lineclear_are         = 0
room_handling         = false
room_handling_arr     = 2
room_handling_das     = 10
room_handling_sdf     = 6
g                     = 0.02
gincrease             = 0.0035
gmargin               = 7200F
garbagemultiplier     = 1
garbageblocking       = combo blocking
garbagemargin         = 10800F
garbageincrease       = 0.008
locktime              = 30F
garbagespeed          = 20F
garbagecap            = 8
garbagecapincrease    = 0
garbagecapmax         = 40
b2bchaining           = false
combotable            = multiplier
clutch                = true
passthrough           = zero
nolockout             = true
boardwidth            = 10
boardheight           = 20
allclears             = true
openerphase           = 14
b2bcharging           = true
allclear_garbage      = 5
allclear_b2b          = 1
roundmode             = down
garbagespecialbonus   = true
```

Important defaults not overridden by the preset include:

```text
receivemultiplier     = 1
cancelmultiplier      = 1
garbagephase          = 0
garbagequeue          = false
garbageentry          = instant
garbageabsolutecap    = 0
garbageattackcap      = 0
garbagetargetbonus    = none
messiness_change      = 1
messiness_inner       = 0
b2bcharge_at          = 4
b2bcharge_base        = 0
```

Some match plumbing (for example enabling garbage at all) is applied by the multiplayer coordinator and is not encoded solely by this preset string.

## 2. `combo blocking` is a placement rule, not merely cancellation

After a piece locks, LineClearManager calculates the clear and attack. For `garbageblocking = "combo blocking"` it calls `FightLines(attack)` and returns a boolean equivalent to:

```text
blocked_this_placement = (linesCleared > 0 OR generatedAttack > 0)
```

`ClearLines()` then sets:

```text
nextwilltank = !blocked_this_placement
```

Therefore in Tetra League:

- any line clear blocks garbage rise for that placement;
- this is true even if the clear generates 0 attack;
- a no-clear placement is eligible to tank mature garbage;
- cancellation and blocking are related but distinct operations.

This is a major implementation detail for downstack timing.

Example:

```text
Pending mature garbage: 8

Piece A: Single, attack = 0
  -> clears a line
  -> no cancellation from attack
  -> combo-blocking still prevents tanking
  -> 8 remains pending

Piece B: no clear
  -> no block
  -> TakeAllDamage()
  -> up to garbage cap lines rise
```

## 3. Garbage cap means per-tank injection cap

`GetGarbageCap()` is:

```text
floor(min(garbagecap, garbagecapmax))
```

`TakeAllDamage()` uses that number as the maximum number of mature garbage lines it will inject during that tank event.

For the built-in Tetra League preset:

```text
garbagecap = 8
garbagecapmax = 40
garbagecapincrease = 0
```

so a normal tank event injects at most 8 lines.

This is NOT a total pending-garbage limit.

`garbageabsolutecap = 0` means the TL preset does not use the absolute pending amount limiter found in some other modes.

## 4. Incoming garbage can be cancelled before it becomes tankable

An incoming packet is inserted into `impendingdamage` before its visual travel time finishes.

The ordinary TL travel delay is:

```text
garbagespeed = 20F ~= 333.3 ms
```

`FightLines()` iterates the impending list regardless of `active/status`, so attack can cancel garbage while it is still in flight.

`TakeAllDamage()`, by contrast, only tanks packets satisfying:

```text
active == true
status == "spawn"
```

Thus the same packet can be:

```text
visible/pending and cancellable
but not yet eligible to rise
```

For TL, `garbagephase=0`, `garbagequeue=false`, and `garbageentry=instant`, so after the 20F travel phase an ordinary packet becomes tankable without additional caution/danger delays.

## 5. Opener phase gives extra cancellation, not extra offence

The TL preset sets:

```text
openerphase = 14
```

Inside `FightLines(attack)` the engine checks:

```text
piecesplaced <= openerphase
AND pendingGarbage >= cumulativeGarbageSent
```

If true, it adds an auxiliary defensive budget equal to the current generated attack.

Conceptually:

```text
normal attack budget   = A
opener defense budget  = A
maximum cancellable    = 2A
```

The cancellation loop consumes the real attack budget first, then the auxiliary defensive budget.

Therefore the bonus cannot create additional outgoing garbage.

Examples:

```text
A = 4, incoming = 2
  cancel 2 using attack
  send remaining 2
  opener defense unused

A = 4, incoming = 6
  normal 4 cancels first 4
  opener defense cancels remaining 2
  send 0

A = 4, incoming = 12
  normal attack cancels 4
  opener defense cancels another 4
  4 remains incoming
  send 0
```

This is a real early-game stabilizer in the engine, not presentation logic.

## 6. Garbage special bonus is applied after multiplier/rounding

The TL preset enables:

```text
garbagespecialbonus = true
```

The ordinary clear attack is first calculated and multiplied/rounded. Then the engine adds one extra attack if:

```text
this clear removed >= 1 garbage row
AND
(clear is Quad OR clear is any recognized Spin, including mini)
```

So a qualifying garbage-clearing recognized spin, including mini, or Quad can send one more line than an otherwise identical clear on clean stack.

Mini-spin classification does not satisfy the `IsSpin()` branch used for this bonus.

Ordering:

```text
base attack
-> B2B/combo modification
-> garbage multiplier
-> round mode
-> +1 garbage special bonus if eligible
-> optional attack cap
-> FightLines
```

## 7. Modern TL B2B charge defaults in this bundle

The preset turns on:

```text
b2bcharging = true
b2bchaining = false
```

and inherits:

```text
b2bcharge_at   = 4
b2bcharge_base = 0
```

`stats.btb` counts qualifying B2B-producing clears internally. The displayed chain generally uses `stats.btb - 1`.

When a normal line clear breaks the chain and:

```text
stats.btb > b2bcharge_at
```

the release amount is:

```text
surge = floor(
    (stats.btb - b2bcharge_at + b2bcharge_base)
    * garbagemultiplier
)
```

The surge is split into roughly three packets:

```text
round(surge / 3)
round(surge / 3)
surge - 2 * round(surge / 3)
```

Each sub-packet independently enters `FightLines()` before the ordinary attack calculation for the chain-breaking clear finishes.

That ordering matters when the player has incoming garbage.

## 8. All Clear is two things in the modern TL preset

The TL preset sets:

```text
allclear_garbage = 5
allclear_b2b = 1
```

An All Clear therefore:

1. contributes to the B2B state through the `allclear_b2b` path;
2. separately generates a 5-line garbage attack through its own `FightLines(5)` call.

The All Clear garbage is not merely folded into the line-clear base table.

## 9. `clutch` rescues some spawn collisions

The TL preset has both:

```text
clutch = true
nolockout = true
```

`ConsiderBlockout()` first checks whether the freshly spawned piece is legal.

If it collides and the previous placement cleared a line, `clutch` allows the engine to repeatedly move the spawning piece upward by one row until it finds a legal position.

Pseudo-code:

```text
if spawn is legal:
    OK
else if last placement cleared and clutch enabled:
    while piece.y > 0:
        piece.y -= 1
        if legal:
            rescue spawn
            return OK
    restore original position
    blockout
else:
    blockout
```

This behavior is important near the ceiling. A clean-room clone that immediately top-outs on every spawn collision will diverge from the official engine.

`nolockout=true` is separate: locking a piece high in the buffer does not itself trigger the normal lockout path. Spawn/blockout and garbage-smash checks still exist.

## 10. Garbage-induced topout uses a separate reason

Board garbage injection sets `lastwasattack=true`.

When the next piece cannot spawn, the engine selects between roughly:

```text
lastwasattack ? "garbagesmash" : "topout"
```

This changes death presentation and killer classification.

For a garbage smash, the client labels the killer effect as `spark` by default and may reclassify it as `spike` based on stack height plus pending garbage.

This classification is presentation/statistics metadata, while the multiplayer coordinator remains responsible for authoritative KO events.

## 11. Zero passthrough uses packet acknowledgements

With:

```text
passthrough = zero
```

outgoing attacks are tracked per target with:

```text
{iid, amt}
```

Incoming interaction packets carry an `ackiid`.

When an incoming attack from the same opponent arrives, the client/server-style engine can subtract it against outgoing attacks newer than the acknowledged interaction ID before creating the incoming packet.

This is not equivalent to simply letting simultaneous attacks cross through each other.

It is an acknowledgement-aware cross-cancellation system and is one reason a multiplayer reconstruction needs interaction IDs, not only integer attack amounts.

## 12. What remains private / not derivable from this client

The client exposes the target strategy state machine and target-assignment messages, but it does not contain the live backend implementation that chooses exact target IDs for FFA policies such as:

```text
EVEN
ELIMINATION
RANDOM
PAYBACK
```

For a 1v1 reimplementation this does not matter: the only opponent is the target.

For an exact large-lobby Quick Play/Battle Royale clone, the server-side target-selection policy still needs independent reconstruction or a deliberately new implementation.

## 13. Clean-room implementation priority

For a faithful Tetra League-style engine, the ordering should be treated as part of the rules:

```text
LOCK PIECE
  -> write piece into board
  -> identify/remove clears
  -> classify spin / B2B / combo
  -> release B2B surge if chain breaks
  -> calculate ordinary attack
  -> FightLines cancellation
  -> apply All Clear attack if any
  -> decide whether this placement blocks garbage rise
  -> if not blocked, TakeAllDamage up to cap
  -> spawn next piece
  -> apply clutch/blockout behavior
```

A clone that has the same attack table but a different ordering can still behave differently in real matches.
