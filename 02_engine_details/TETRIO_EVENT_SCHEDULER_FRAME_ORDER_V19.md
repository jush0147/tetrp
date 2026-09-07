# TETR.IO v19 Frame and Waiting-Event Scheduler

This document records the exact high-level per-frame order in the official client engine and the deterministic waiting-event semantics.

## 1. Core frame order

For a synced game whose next frame is available, the main simulation step performs:

```text
1. subframe = 0
2. EventStream.Pull()
   - emit all replay/keyboard/socket events whose event.frame == current stream frame
3. EventStream.AdvanceFrame()
   - increment stream frame
4. InputManager.ProcessAllShift()
   - DAS / ARR continuous movement
5. FallingPieceManager.Fall()
6. InputManager.ProcessInterrupts()
7. WaitingFrameManager.ExecuteWaitingFrames()
8. WaitingFrameManager.ExecuteUnsafeWaitingFrames()
9. BoardManager.ProcessGarbageARE()
10. RulesManager.CheckObjectiveCleared()
11. Lower spike timer
12. Process hesitated attacks
13. fire / dynamic gravity / garbage multiplier / garbage cap updates
14. survival / targeting / actors / zenith / sound updates
15. replay frame advances and periodic `full` snapshot may be emitted
```

This ordering is part of deterministic gameplay, not presentation detail.

## 2. Event-frame vs simulation-frame subtlety

`Pull()` runs before `AdvanceFrame()`.

Therefore an input event labeled frame `F` is emitted while the event stream still reports frame `F`. Immediately afterward, the stream advances to `F + 1`, and continuous movement, gravity, waiting events and garbage ARE for that outer simulation step see the incremented frame.

Code that stores scheduled targets from inside event handlers must preserve this distinction.

## 3. Waiting frame representation

A deterministic wait is stored as:

```text
{
  target: currentEventStreamFrame + delay,
  type,
  data
}
```

At execution time, the engine fires entries only when:

```text
entry.target === currentEventStreamFrame
```

There is no `<=` catch-up check for ordinary waiting frames.

The main deterministic waiting-event types observed include:

- `are`
- `are_collapse`
- `clearanim`
- `incoming-attack-hit`
- `start-explode-attack`
- `process-exploded-attack`
- `outgoing-attack-hit`
- `process-garbage-status`
- `push-garbage-line`
- `freeze-counters`
- revive-related Zenith events

## 4. Same-target ordering

`waitingframes` is iterated from the end of the array toward the beginning.

Therefore, if two events have the same target frame, the one that was scheduled **later** executes **first**.

This is LIFO ordering for equal target frames.

A clean-room implementation using a normal FIFO priority queue would differ in this edge case unless it adds a descending insertion-sequence tie breaker.

## 5. Unsafe waiting frames

`WaitFramesUnsafe(delay, callback)` stores executable callbacks rather than serializable `{type,data}` events.

These are also iterated in reverse insertion order.

`ExecuteUnsafeWaitingFrames(true)` force-runs all pending unsafe callbacks regardless of target frame. This is used around scope changes / state overlays and is intentionally excluded from canonical serialized state.

For clean-room gameplay, deterministic rules should use typed waiting events. Unsafe callbacks are runtime plumbing and should not be copied as a gameplay mechanism.

## 6. Important ARE interaction

The deterministic `are` event performs:

```text
if nextwilltank:
    TakeAllDamage()
Next(..., fromARE=true)
```

Therefore garbage tanking can be deferred to the ARE transition itself. This must remain ordered after line-clear attack/cancellation and before the next piece actually spawns.

## 7. Safelock implementation leak

`safelock` decrements every time `Fall()` is called, not once per integer 60Hz frame.

Subframe input processing may invoke extra partial `Fall(delta)` calls inside a frame. Therefore safelock lifetime is technically measured in Fall invocations, not strictly seven wall-clock simulation frames.

This is an implementation-specific behavior worth matching only if exact oracle conformance is required.
