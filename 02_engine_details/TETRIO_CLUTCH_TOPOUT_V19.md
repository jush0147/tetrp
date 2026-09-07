# TETR.IO v19 clutch, lockout and blockout behavior

Source basis: behavior traced from the v19 production client in the local standalone package.

## 1. Two different rescue mechanisms share the clutch concept

There is a lock-time lockout path and a next-piece spawn/blockout path. They should not be implemented as one generic topout check.

## 2. Lock-time lockout

When a piece is written into the stack, the board writer returns whether the entire locked piece lies above the visible-board boundary.

If that condition is true, the engine invokes the lockout handler after line clear processing.

Behavior:

- if `nolockout` is enabled: lockout is ignored
- otherwise, if the placement did not clear a line: game over
- otherwise, if `clutch` is disabled: game over
- otherwise: the clear rescues the lockout and a clutch presentation effect is shown client-side

Current built-in Tetra League has `nolockout=1`, so this lock-time form does not kill the player in that ruleset.

## 3. Spawn/blockout check

Every new piece is initially placed at its normal spawn coordinates and checked for collision.

If spawn is legal, normal play continues and the clutch streak counter may reset.

If spawn is illegal, a rescue is attempted only when:

- the previous placement actually cleared at least one line, and
- `clutch` is not disabled.

The rescue loop moves the spawning piece upward one row at a time (and adjusts its historical-Y state in parallel) until either:

- a legal position is found, or
- the piece reaches the top search boundary (`y <= 0`) without finding one.

There is no fixed one-row rescue limit in this code path.

If no legal position is found, the spawn is a blockout/topout.

## 4. IRS / IHS ordering around blockout

The next-piece path does more than one collision check:

1. create the piece at spawn rotation and spawn position
2. perform an initial blockout check
3. resolve buffered IHS when applicable
4. apply buffered IRS when applicable
5. perform another blockout check after the initial-action transformations

This matters for a faithful clone: spawn legality cannot be checked only once before IRS/IHS.

The engine suppresses some clutch-count bookkeeping on secondary/internal checks, so presentation streaks are not identical to the number of collision probes.

## 5. Clutch streak presentation

A successful primary spawn rescue increments a `clutchCount` value. Consecutive rescues have escalating audio/presentation feedback. A normal legal spawn resets the count on the primary check.

This counter is presentation/state metadata; the actual rescue search does not appear to use it as a hard maximum.

## 6. Failure reason

When a spawn ultimately fails, the client distinguishes ordinary `topout` from `garbagesmash` based on whether the board was most recently raised by garbage. This is primarily a reason/feedback distinction; both are terminal through the stock/game-over handler unless another stock/revive system applies.

## 7. Clean-room implementation order

For Tetra League-compatible spawning:

- preserve the 40-row board with the visible boundary separated from the buffer
- do not kill solely because a lock happens entirely above the visible boundary when `nolockout` is enabled
- after a clear, allow spawn clutch rescue by moving the next piece upward until legal
- apply IHS/IRS in the same order as the source behavior and re-check blockout
- distinguish blockout from lockout

This ordering is more important than the visible CLUTCH effect. A clone can look correct while dying in positions where TETR.IO survives if it collapses these checks into a single topout rule.
