# TETR.IO v19 Frame / Input Ordering (clean-room reference)

Source: official production client bundle from the local package, engine version 19.

## 1. Core tick

The gameplay simulation advances in fixed 1/60-second ticks. Rendering is separate.

At the beginning of each gameplay tick, `state.subframe` is reset to 0. The event source then emits all events assigned to the current source frame, in stored/insertion order. After event emission, the source frame counter is advanced. The engine then completes the remaining part of the simulation frame and runs post-input systems.

High-level order:

```text
subframe = 0
EventStream.Pull()                 // events for current source frame
EventStream.AdvanceFrame()         // source frame increments here
Input.ProcessAllShift()            // remaining 1-subframe interval
FallingPiece.Fall()                // remaining 1-subframe interval
Input.ProcessInterrupts()          // forfeit/retry hold logic, NOT rotations/drop
WaitingFrames.Execute()
UnsafeWaitingFrames.Execute()
Board.ProcessGarbageARE()
Rules.CheckObjectiveCleared()
Spike.LowerSpikeClock()
Attack.ProcessHesitatedAttacks()
Fire.LowerFire() if enabled
Gravity growth
Garbage multiplier growth
Garbage cap growth
Stats/UI manager update
Target manager update
Actor progress
Tracker update
Zenith update
SFX update
Replay.AdvanceFrame()
optional 300F replay `full` snapshot
catch-up / extra simulation frames if remote source is behind
```

Important: rotate, hard drop, hold and movement keydown actions are not deferred to `ProcessInterrupts()`. They execute while `EventStream.Pull()` emits each input event.

## 2. Subframe processing

Keyboard events carry a `subframe` rounded down to 0.1-frame units, giving nominal 1/600-second (about 1.667 ms) ordering resolution.

Before a keydown or keyup is applied:

```text
_ProcessSubframe(event.subframe):
    if event.subframe <= state.subframe:
        return
    dt = event.subframe - state.subframe
    ProcessAllShift(dt)
    FallingPiece.Fall(dt)
    state.subframe = event.subframe
```

Therefore, a frame containing events at 0.2 and 0.7 behaves approximately as:

```text
frame start, t=0.0
  simulate held horizontal + gravity for 0.2F
  apply event A immediately
  simulate held horizontal + gravity for 0.5F
  apply event B immediately
  source frame counter increments
  simulate held horizontal + gravity for final 0.3F
  post-input systems
frame end
```

The engine does not sort same-frame events by subframe in `Pull()`. It preserves event-array order. Normal browser input arrives chronologically and exported replay preserves that order. A malformed/reordered replay with decreasing subframes is not rewound: `_ProcessSubframe()` simply ignores an event subframe that is <= the already-processed subframe, then executes that event at the current simulated time.

## 3. Immediate keydown semantics

After advancing to the event subframe, keydown actions happen immediately.

### Move left/right

```text
activate shift state
perform one immediate horizontal shift attempt
```

The immediate shift exists independently of DAS/ARR repeats.

### Soft drop

```text
inputSoftdrop = true
```

No immediate `Fall()` is called by the soft-drop action itself. Its effect begins on the next subframe segment / remaining-frame `Fall()` call.

### Rotation

```text
set held IRS flag
if not paused:
    Rotate(direction) immediately
```

Rotation therefore happens at the input subframe, after gravity/shift have been advanced up to that exact subframe.

### Hard drop

If hard drop is enabled and `falling.safelock == 0`:

```text
Harddrop() immediately
```

`Harddrop()` repeatedly attempts one-cell internal falls and then locks immediately on collision.

### Hold

```text
set held IHS flag
if not paused:
    Hold() immediately
```

## 4. Keyup semantics

Keyup also first advances the simulation to its subframe. It then mutates held states.

Horizontal release:
- clears that direction's `held`
- resets its DAS to 0
- may switch `lastshift` to the opposite held direction
- with handling cancel enabled, resets opposite ARR/DAS state

Soft-drop release clears `inputSoftdrop` after the pre-event subframe fall has already happened.

IRS/IHS held flags are similarly cleared only after advancing to the event time.

## 5. Consequences for simultaneous-looking input

Because every event first advances simulation to its own subframe, order matters even inside one 60 Hz frame.

Example:

```text
0.2F rotate CW
0.7F hard drop
```

means:
1. gravity/held movement run for 0.2F;
2. rotate at 0.2F;
3. gravity/held movement run another 0.5F with the rotated piece;
4. hard drop at 0.7F.

It is not equivalent to applying both inputs at the start or end of the frame.

For two events with identical subframe values, insertion order decides which action runs first because the second `_ProcessSubframe()` does not advance time.

## 6. Source-frame counter nuance

`EventStream.AdvanceFrame()` occurs after all events for frame N have been emitted but before the remaining `(1-subframe)` movement/gravity segment is simulated.

Thus code executed inside an input callback observes source frame N; systems in the rest-of-frame section may observe source frame N+1. A clean-room implementation seeking replay-level compatibility should copy this sequencing rather than treating the frame counter as a purely end-of-tick increment.

## 7. Lock timing

When gravity cannot move the piece, `Fall(dt)` calls:

```text
_InternalLocking(dt)
```

For engine v15+:

```text
piece.locking += dt
lock when:
    locking > locktime
    OR forced-lock flag
    OR movement lock-reset limit reached
```

The comparison is strictly `>` rather than `>=`.

Because `dt` can be fractional due to subframe events, lock accumulation is fractional frame-units. A nominal `locktime=30` should therefore not be implemented as a simple integer `if timer >= 30` counter if exact replay compatibility is desired.

## 8. Safelock implementation leak

When a natural gravity lock occurs and handling safelock is enabled, the engine sets:

```text
piece.safelock = 7
```

Hard drop keydown is rejected while `safelock != 0`.

However `safelock` is decremented at the beginning of every public `Fall(dt)` call:

```text
if (piece.safelock > 0)
    piece.safelock--
```

This is call-count based, not `dt` based.

Because `_ProcessSubframe()` can invoke `Fall(dt)` multiple times during a single 60 Hz frame, multiple distinct positive-subframe events can burn multiple safelock counts in one frame. The normal no-extra-input path decrements it once per frame, but exact compatibility requires preserving the call-count behavior.

This is an implementation quirk rather than a clean conceptual "7 exact simulation frames" timer.

## 9. Horizontal repeat ordering

For each simulated time segment, left and right shift states are processed in this fixed order:

```text
[lShift, rShift]
```

Each `_ProcessShift` only acts if that state is held AND its direction equals `lastshift`. Therefore when both directions are physically held, `lastshift` is the arbitration mechanism; only the currently selected direction repeats.

DAS accumulation accepts fractional `dt`.

For engine v15+:

```text
newly charged portion = max(0, dt - max(0, DAS_setting - current_DAS))
DAS = min(DAS + dt, DAS_setting)
if DAS full:
    ARR += newly_charged_portion
```

If ARR is zero, the repeat count for that processing pass is board width (`W`), effectively attempting to slide all the way to the wall.

## 10. Why this matters for a clone

A superficially similar engine that does this once per frame:

```text
read all keys
apply rotations/moves
gravity += 1 frame
lock timer += 1
```

will diverge on:
- same-frame rotate/drop ordering
- soft-drop start/release boundaries
- fractional DAS/ARR charging
- lock timing near 30F
- IRS/IHS event timing
- safelock edge cases
- malformed/reordered replay event behavior
- deterministic remote replay reconstruction

For a clean-room implementation, treat the frame as a 0.0..1.0 timeline with input events inserted at 0.1F resolution, advance held movement + gravity between event timestamps, execute each event immediately, then finish the remainder of the frame.
