# TETR.IO v19 Placement / Clear / Garbage / Next-Piece Ordering

This document records the exact semantic order around one piece locking. This is one of the highest-value clean-room compatibility sequences because attack, cancellation, tanking, topout, ARE, IHS/IRS and the next spawn all meet here.

## 1. Lock entry

If the falling piece is already sleeping, `Lock()` exits.

Otherwise the engine first performs lock bookkeeping:

1. emit lock event with piece/input timing data
2. mark falling piece sleeping
3. increment pieces placed and mode-specific stale-piece counters
4. update mode prompts/telemetry
5. record last piece time
6. play client-only impact effects

Only after this bookkeeping does stack mutation begin.

## 2. Commit piece to board

The active tetromino is written to `board` / `boardEdges` using the board manager.

The commit returns the lockout predicate described elsewhere: whether the entire placed tetromino lies above the visible boundary.

This board mutation occurs **before** full-line detection and spin/attack resolution.

## 3. Run `ClearLines()` as one composite transaction

`ClearLines()` performs more than line deletion. Its semantic sequence is:

### 3.1 Detect lines and initialize placement offence record

- collect all clearable full rows
- record the offensive display position
- zero this placement's offence/defence/surge display counters
- set `lastWasClear`
- reset `lastReceivedCount`

### 3.2 Count downstack/garbage-row information

Before rows are removed, the engine counts relevant cleared garbage rows. This count later feeds garbage-cleared stats and the TL garbage-special bonus.

### 3.3 Mutate board

If lines exist, remove them immediately from gameplay board state.

If line-clear ARE is enabled, the visible collapse animation can remain deferred even though canonical board mutation already happened.

### 3.4 Determine All Clear state

After board mutation, evaluate the mode-specific empty-board predicate.

### 3.5 Resolve ordinary clear offence / defence

Run the ordinary line-clear announcement/calculation pipeline:

- spin / mini / line count
- combo
- B2B / charge / possible surge release
- score
- ordinary attack
- garbage-special bonus
- attack cap / rounding / multipliers
- `FightLines()` cancellation as appropriate for garbage-blocking mode

The return value from this pipeline determines whether the placement is permitted to tank garbage immediately afterward.

The engine stores:

```text
nextWillTank = NOT ordinary-clear-blocked-tanking
```

For current Tetra League `combo blocking`, any actual line clear blocks tanking for this piece transition, even if the clear generated zero attack.

### 3.6 Garbage ARE bump when tanking was blocked

If `nextWillTank` is false, extend `garbageARELockedUntil` by at least the configured garbage-ARE bump.

This prevents continuous garbage-ARE insertion from immediately undoing the clear's protection window.

### 3.7 Resolve All Clear as a second attack/cancel phase

If All Clears are enabled, run the All Clear announcement after the ordinary-clear pipeline.

Its garbage value is processed as a **separate** `FightLines()` call rather than merged into the ordinary attack packet.

Therefore an All Clear can consume another portion of pending garbage after the placement's ordinary clear already cancelled some.

### 3.8 Decide whether to tank now or defer to ARE

If `nextWillTank` remains true, the engine decides between immediate and deferred tanking.

Semantic rule:

```text
if nextWillTank:
    transitionDelay = lineclearARE if linesCleared else ARE

    if transitionDelay != 0 AND garbageEntryMode == "instant":
        keep nextWillTank = true
        # ARE handler will tank later
    else:
        TakeAllDamage()
        nextWillTank = false
```

Thus with zero ARE, a no-clear placement that is allowed to tank receives mature garbage immediately inside `ClearLines()`.

With positive ARE and `garbageentry = instant`, tanking is postponed until the ARE completion handler.

### 3.9 Final offence / mode bookkeeping

After the tank decision:

- announce/update offensive UI/state
- run post-line-clear mode hooks
- return number of cleared lines

## 4. Back in `Lock()`

After `ClearLines()` returns:

1. choose transition delay:
   - line clear -> `lineclear_are`
   - no clear -> `are`
2. if `garbageentry == delayed`, delay may be enlarged using `lastReceivedCount * garbageARE`
3. evaluate finesse result / optional pro-mode fault behavior
4. apply lockout logic using:
   - whether piece was entirely above visible region
   - whether the placement cleared lines
   - `nolockout` / `clutch` rules
5. run mode-specific level progression

Then:

```text
if transitionDelay > 0:
    schedule waiting-frame event "are"
else:
    spawn Next() immediately
```

## 5. ARE completion handler

When the scheduled `are` waiting-frame event fires:

```text
if nextWillTank:
    TakeAllDamage()
Next(undefined, fromARE=true)
```

This establishes an exact ordering:

```text
lock
 -> board commit
 -> clear / attack / cancellation / All Clear
 -> optional deferred garbage tank
 -> next-piece spawn
```

The next piece never spawns before a deferred `nextWillTank` is resolved.

## 6. Current Tetra League simplification

Current TL v19 uses:

```text
ARE = 0
lineclear ARE = 0
garbage blocking = combo blocking
```

So the common TL transition simplifies to:

### Placement with a line clear

```text
lock
 -> write piece
 -> clear rows
 -> calculate/cancel/send attack
 -> block tanking this transition
 -> spawn next piece immediately
```

### Placement with no line clear

```text
lock
 -> write piece
 -> calculate no-clear outcome
 -> if mature garbage is tankable, TakeAllDamage now
 -> possibly push active/board state according to garbage pipeline
 -> spawn next piece immediately
```

No normal piece ARE hides this ordering in TL; it all occurs in the same simulation-frame processing path.

## 7. Continuous garbage ARE remains a separate late-frame path

The per-frame loop also runs `ProcessGarbageARE()` later in the frame after input, falling and waiting-frame handlers.

Do not confuse:

- placement-transition `TakeAllDamage()`
- waiting-frame `are` tanking
- continuous `ProcessGarbageARE()` one-entry processing

They are distinct entry points into garbage/board mutation and can occur at different points in the frame lifecycle.

## 8. Why clean-room clones get this wrong

A naive implementation often does something like:

```text
lock
 -> tank pending garbage
 -> clear lines
 -> calculate attack
 -> spawn next
```

That is observably different from TETR.IO.

It changes:

- whether a clear gets to cancel incoming garbage before tanking
- whether zero-attack clears still protect a combo-blocking transition
- whether All Clear's separate 5 attack can defend before tanking
- when B2B Surge is released relative to the breaking clear
- which board the next piece spawns against
- garbage-hole RNG consumption history
- possible clutch / blockout outcomes

## 9. Differential test cases

High-value tests for this transition:

1. no-clear lock with mature incoming garbage
2. Single that sends 0 but blocks TL tanking
3. TSD with enough pending garbage to consume all ordinary attack
4. All Clear where ordinary attack cancels one packet and AC bonus cancels a second
5. break B2B charge with pending garbage; verify Surge cancellation precedes breaking-clear attack
6. positive ARE custom game with `garbageentry=instant`
7. positive ARE custom game with `garbageentry=delayed`
8. line-clear ARE plus active garbage queue
9. lockout-above-visible combined with a line clear / clutch settings
10. tanked garbage changes next spawn from legal to blockout/clutch
