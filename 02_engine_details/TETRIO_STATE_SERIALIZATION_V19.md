# TETR.IO v19 State Serialization / Restore Layers

This document separates the different meanings of "state" in the production client. They are intentionally not equivalent.

## 1. Replay `Snapshot()` / periodic `full`

The replay-facing snapshot is a compact gameplay anchor. Its semantic shape is:

```text
game:
  board
  bag
  hold:
    piece
    locked
  g
  controlling:
    left-shift state
    right-shift state
    last-shift direction
    soft-drop held
  falling
  handling
  playing
stats
diyusi
```

This snapshot is pushed:

- at game start
- periodically according to `fullinterval`; normal observed interval is 300 simulation frames (5 seconds at 60 Hz)

Important: it is **not a complete deterministic save state**. In particular, it does not carry the live `rng` / `rngex` generator seeds or every multiplayer/garbage bookkeeping field.

Use it as a replay/synchronization anchor, not as the canonical clean-room rollback state.

## 2. Replay `Export()`

The exported replay result extends the compact snapshot with outcome and summary metadata, including semantically:

```text
successful
gameover reason
full game options
killer
aggregate stats:
  APM
  PPS
  VS score
+ compact Snapshot payload
```

The aggregate metrics are derived at export time from frame count and tracked stats. They are not separate authoritative simulation variables.

## 3. `EjectState()` = closest thing to a complete deterministic engine state

The full eject operation deep-clones essentially the complete game-state object and additionally records:

```text
frame
constant overrides
```

Before cloning, runtime PRNG objects are converted to their current numeric seeds:

```text
rng   -> rng.seed
rngex -> rngex.seed
```

Unsafe waiting-frame callbacks are deliberately excluded/reset.

It also forces restored state flags such as `started` and `countdown_started` to a live-state form.

This layer contains far more than the replay `full` snapshot, including the state required for garbage queues, attack acknowledgement ledgers, waiting frames, target state, lock/input counters, and the two PRNG streams.

For clean-room differential testing, this is the conceptual reference for a complete checkpoint.

## 4. What the full game-state object contains

The v19 default state demonstrates the major deterministic domains that a compatible engine must model.

### Lifecycle / timing

- subframe
- started / countdown-started / playing / paused / destroyed
- success / endqueued / gameover reason
- safe waiting frames
- garbage ARE lock timestamp and entries
- game clock fields / frame offset

### Board / queue / piece

- board
- board edge metadata
- bag / extended bag / bag id
- hold piece / hold lock
- falling piece:
  - type
  - x/y
  - rotation
  - historical low Y
  - IRS accumulator
  - kick index
  - input key count
  - state/action/spin flags
  - safelock
  - lock timer
  - lock reset count
  - rotation reset count
  - skipped visual/actor cells
- total rotations
- clutch count

### Input / handling state

- left and right shift objects:
  - held
  - ARR accumulator
  - DAS accumulator
  - direction
- last shift direction
- soft drop held
- CCW/CW/180 held
- hold held
- first input timestamp
- current handling settings

### Gravity / progression

- current gravity `g`
- gravity lock
- level / lines / level progress
- score
- placement
- fire / display-related gameplay meters

### Offensive state

- combo / top combo / combo power
- B2B / top B2B / B2B power
- detailed clear counters
- pieces placed
- garbage sent / attack / cleared / received
- max spike
- last offensive placement and offence/defence/surge values
- last attack/tank times
- spike accumulator/timer

### Garbage state

- impending damage packets
- garbage IDs
- garbage ARE entries
- garbage received counters
- last garbage column / whether column changed
- pending next-tank decision
- cancellation streak
- opener/interaction-related accounting
- `garbageacknowledgements` outgoing/incoming ledgers
- hesitated attacks

### Target / multiplayer state

- enemies
- targets
- last strategy change
- interaction ID
- killer metadata

### RNG

- primary gameplay/bag PRNG state
- secondary/garbage/extra PRNG state

### Mode-specific state

A large Zenith/Quick Play state block is part of the same game state. Even if a first clean-room engine omits that mode, it should not pretend the generic TETR.IO state is only `board + current piece + score`.

## 5. `InjectState()` restore procedure

State restoration is not a raw object assignment followed by hope.

The client semantically performs:

1. refuse certain restore operations when already online+synced
2. flush unsafe waiting-frame work
3. reconstruct both PRNG objects from numeric seeds
4. merge/replace serializable fields into the live game-state object
5. restore constant overrides and reload constants
6. resize board geometry if necessary
7. invalidate gameplay collision memo
8. clear seen-IGE bookkeeping
9. reset render/interpolation timing caches
10. reset garbage-bar / visual caches
11. redraw actors / restate holder UI
12. recreate renderer holder if dimensions or skin configuration changed

A clone should separate canonical simulation state from derived caches in the same way. Derived caches should be rebuilt after checkpoint restore rather than serialized as truth.

## 6. `EjectOverlayState()` / overlay restore

Overlay state is similar to the full game state but excludes nested `otherstates` history and unsafe waits. It still preserves PRNG seeds and game data.

It is intended for local undo/overlay-style operations rather than network synchronization.

## 7. Compact board-only state

The client also has a deliberately lossy board-state format for cheap remote display:

```text
b = board rows from highest occupied row downward
f = fire meter
g = garbage received
w = width
h = visible height
```

On injection:

- board geometry may be resized
- missing top rows are padded with empty rows
- `boardEdges` is recreated as all `255`
- tiny-board rendering is forced dirty

This proves board snapshots are a display/spectator optimization, not a deterministic simulation checkpoint.

## 8. State hierarchy

A useful mental model is:

```text
Board snapshot
  cheapest, lossy remote visual state
        <
Replay full snapshot
  enough to anchor/seek visible gameplay
        <
Replay export
  snapshot + result/options/aggregates
        <
EjectState
  near-complete deterministic checkpoint + RNG + frame + overrides
```

Treating these as interchangeable is an easy way to build a replay system that works for 30 seconds and then begins inventing alternate timelines.

## 9. Recommended clean-room checkpoint

For our own compatible engine, a canonical checkpoint should explicitly include at minimum:

```text
frame + subframe
board + gameplay material types
bag + bag id
hold + hold lock
falling piece full state
left/right DAS+ARR accumulators + held-input state
handling
current gravity and progression timers
combo/B2B state
incoming garbage packets and ARE queue
garbage acknowledgement ledger
last garbage hole / messiness state
attack/spike timers
both PRNG seeds
mode-specific gameplay state that can affect future decisions
```

Do not include renderer sprites, Pixi containers, audio handles, or legality-cache contents as canonical state.

## 10. Differential-testing payoff

Once a clean-room engine can export this canonical checkpoint each frame, comparison with the official local client can identify the **first divergent field**, not merely the first visibly divergent board.

Examples:

- same board, different `rngex` -> future garbage will diverge later
- same piece coordinates, different DAS accumulator -> next movement diverges
- same visible garbage bar, different acknowledgement ledger -> future passthrough diverges
- same board, different B2B charge -> future surge diverges
- same board and queue, different safelock -> next hard drop diverges

This is the practical route to near-bit-exact behavioral compatibility.
