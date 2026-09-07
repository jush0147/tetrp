# TETR.IO Replay / Multiplayer Wire Protocol Notes

Reverse-engineered from the production client bundle in `01_Official_Standalone`.

Status labels used here:
- **Proven**: directly visible in the client serializer / runtime logic.
- **Inference**: architectural conclusion consistent with the client, but not proof of server implementation.

## 1. `game.replay` rolling packet

**Proven.** The client sends rolling replay data using a compact binary object (minified class `Te`).

Logical schema:

```text
ReplayPacket {
  gameid: UInt13
  provisioned: DInt
  frames: packed FrameEvent[]
}
```

`provisioned` is the sender's current provisioned frame and is used by remote EventStream instances to decide whether the next frame is safe to simulate.

The receiver updates:

```text
_lastProvision = packet.provisioned - previousProvision
_provision     = packet.provisioned
```

and appends the supplied frame events.

## 2. Frame event format

**Proven.** Each `FrameEvent` (`Ee`) contains:

```text
type: table-coded event type
frame: DInt
payload: type-specific
```

Known event variants:

### `keydown` / `keyup`

```text
key: table-coded action
hoisted: Boolean
subframe: fixed float, 4-bit integer domain with /10 scale
```

The source records subframe timing in tenths of a 60 Hz frame, nominally about 1.667 ms steps.

### `start`

No payload.

### `full`

A structured synchronization snapshot (`De`), detailed below.

### `end`

Structured end state.

### `ige`

An Interaction Game Event (`$e`).

### `strategy`

```text
strategy: UInt3
```

### `manual_target`

```text
gameid: UInt13
```

Unknown/future event types fall back to the generic packer.

## 3. Periodic `full` synchronization snapshot

**Proven.** A `full` event is emitted at game start and, by default, every 300 frames (5 seconds):

```text
fulloffset  = 300
fullinterval = 300
```

The payload is NOT a complete save-state of every hidden engine variable. It is a compact gameplay synchronization snapshot.

Logical contents:

```text
FullSnapshot {
  game: {
    bag
    board
    hold: { piece, locked }
    g
    controlling: {
      inputSoftdrop
      lastshift
      lShift: { held, arr, das }
      rShift: { held, arr, das }
    }
    falling
    handling
    playing
  }
  diyusi
  stats
}
```

Notably absent from this wire snapshot:

```text
current rng seed
current rngex seed
```

That matters. A `full` event is therefore best understood as a **resynchronization / presentation anchor**, not a self-contained deterministic save point from which all future randomness can necessarily be regenerated without earlier context.

The separate `EjectState()` path *does* include current RNG seeds and is the genuinely fuller restoration state.

## 4. Falling-piece wire state

**Proven.** The falling piece structure (`Pe`) contains:

```text
type        table-coded piece
x           signed int bounded by board width
r           UInt2
hy          UInt(board-height width)
irs         UInt2
kick        UInt5
keys        UInt16
flags       UInt(FLAGS_COUNT)
safelock    UInt3
lockresets  UInt5
rotresets   UInt6
skip[]      optional 7-bit terminated list
y           Double
locking     Double
```

This is much richer than a simple `(piece,x,y,rotation)` snapshot. It preserves enough lock/rotation/input state to visually and mechanically resume a remote falling piece with very little discontinuity.

## 5. Statistics in `full`

**Proven.** The compact stats structure includes, among other fields:

- lines / level lines / lines needed
- input count
- holds
- score
- level
- combo / top combo / combo power
- B2B / top B2B / B2B power
- T-spins
- pieces placed
- per-clear counters
- garbage sent
- garbage sent without multiplier
- max spike / max spike without multiplier
- garbage received
- attack generated
- garbage cleared
- kills
- finesse combo / faults / perfect pieces
- Zenith statistics

This is why a newly scoped spectator can receive a meaningful state without replaying an entire match from frame 0 just to populate UI counters.

## 6. Board-only sync packet

**Proven.** `game.replay.board` uses a cheaper packet (`Fe`) for one or more boards:

```text
BoardPacket {
  count: UInt13
  boards[] {
    gameid: UInt13
    fire: UInt10
    garbageReceived: DInt
    width
    height
    compressedBoard
  }
}
```

The client refuses to apply this cheap board state when a game is already marked `synced`.

This supports the architecture observed elsewhere:

1. important/scoped remote games: full deterministic replay simulation;
2. cheap/unscoped remote games: board snapshots only.

## 7. IGE wire format

**Proven.** An Interaction Game Event contains:

```text
id: DInt
frame: DInt
type: table-coded
payload: type-specific
```

Known types:

### `interaction`
Garbage interaction structure.

### `interaction_confirm`
Subtypes include:
- `garbage`
- `zenith.climb_pts`
- `zenith.bonus`
- `zenith.incapacitated`
- `zenith.revive`
- `zenith.attack`

### `target`

```text
count: UInt13
targetGameIDs[]: UInt13
```

### `targeted`

```text
value: Boolean
gameid: UInt13
frame: DInt
```

### `allow_targeting`

```text
value: Boolean
```

### `kev`

```text
victimGameID: UInt13
killerGameID: UInt13
frame: DInt
fire: UInt10
```

### `custom`
Structured custom payload.

Some received IGEs are explicitly delayed until another referenced game's simulation reaches the required frame. The client can wait up to roughly 4 seconds before giving up. That makes cross-player effects frame-aligned rather than merely arrival-order-aligned.

## 8. Rolling replay batching / latency mode

**Proven code, interpretation partly unresolved.**

The replay buffer has latency modes:

```text
zero:   slowest=15, fastest=2,  jump=4
low:    slowest=15, fastest=6,  jump=8
medium: slowest=50, fastest=6,  jump=15
high:   slowest=50, fastest=15, jump=30
xhigh:  slowest=50, fastest=50, jump=50
```

Default game option:

```text
latencymode = "medium"
```

The buffer automatically flushes when its provision counter reaches `provisionSpeed`, or when `FlushNextFrame()` has been requested.

Important implementation detail:

- gameplay events named `interaction` or `action`, when listeners exist, request `FlushNextFrame()`;
- ordinary keyboard down/up does not directly request an immediate flush;
- an `end` event forces a flush.

The current minified code's `provisionSpeed` adjustment appears counterintuitive because `_FastestSpeed` is defined but not visibly referenced by this logic. Rather than invent a story, treat the exact lookup and update code as proven while the intended semantics of all five user-facing latency labels remains unresolved.

## 9. Remote catch-up and spectator smoothing

**Proven.** Socket/pipe-backed games are not allowed to simulate past the sender's provisioned frame.

When a remote game is more than 60 frames behind its provision frontier:

```text
provision > localFrame + 60
```

TETR.IO recursively simulates extra frames to catch up. During this burst it progressively reduces `soundSkipRate`, eventually suppressing sound entirely if necessary.

For a visible non-tiny board, backlog above 90 frames can trigger the client network `loss` warning.

There is a second gentler catch-up path based on:

```text
behindness = (provision - frame) / lastProvision
```

When `behindness >= 1.25`, it periodically executes an extra simulation frame. The interval is:

```text
max(floor(8 - (behindness - 1.25)), 0) + 2
```

So remote boards converge toward real time by temporarily simulating faster rather than snapping every visual element to a server-provided board image.

## 10. `full` events versus replay export

**Proven.** `StripBloat()` removes all `full` events from a replay and simplifies the start/end payloads.

Also, replay preprocessing can independently re-simulate the replay headlessly and generate richer `EjectState()` checkpoints every 300 frames for seeking/analysis.

This separates three concepts that are easy to conflate:

1. rolling online `full` events: compact synchronization anchors;
2. stripped persisted replay: mostly event stream without those anchors;
3. preprocessed replay states: fully ejectable local engine states generated by deterministic re-simulation.

## 11. What this proves about multiplayer architecture

**Proven client behavior:**

- the local player is simulated locally;
- remote scoped players can be simulated locally using the same engine from frame-tagged replay events;
- the client periodically receives/provides synchronization aids rather than full-board-per-frame state;
- cheap board-only state exists for unscoped remote boards;
- cross-player IGEs carry explicit frame context.

**Strong inference:** the network architecture is designed around deterministic event-stream simulation plus state repair, not continuous authoritative framebuffer/board streaming.

**Not proven from this client bundle:**

- whether the official backend literally runs the same JavaScript build;
- exactly how aggressively the server validates input/replay state;
- whether the periodic/full state mechanisms are used for anti-cheat;
- the full server-side matchmaking/rating/authority implementation.

The browser helper named `IsServer()` is not evidence by itself: in this production build, headless local simulation can enter those branches.
