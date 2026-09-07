# TETR.IO v19 Clean-Room Reconstruction Readiness Audit

## Decision

Reverse engineering has reached the point where continuing to statically dissect the production bundle has lower expected value than implementing a clean-room engine and differential-testing it against the official client.

For ordinary 40 LINES, BLITZ and Tetra League gameplay, the behaviorally important client-side mechanics are now sufficiently specified to begin implementation without guessing the core rules.

## High-risk systems already resolved

### Piece / board physics

- exact standard piece matrices and pivots
- SRS+ kick data, including I-piece differences and 180 transitions
- fractional Y coordinate model
- `ceil(y)` collision mapping
- epsilon handling around integer row boundaries
- board size / hidden buffer model
- piece spawn coordinates
- hard drop / soft drop / gravity flow
- 20G gating behavior
- lock delay and reset behavior
- board mutation, line removal and unclearable `gbd`

### Input / handling

- 60Hz deterministic core loop
- 0.1-frame input subframes
- browser key-repeat ignored
- DAS / ARR / DCD
- DAS preservation behavior
- IRS / IHS ordering
- safelock behavior
- same-frame input processing order
- finesse lookup table and accounting

### Piece lifecycle

- 7-bag generation and prefill behavior
- Hold state transition
- IHS before IRS on spawn
- blockout / lockout / clutch behavior
- exact lock -> line clear -> attack -> garbage tank -> ARE -> next ordering

### Spin / scoring / attacks

- T-spin corner logic
- all-mini+ fallback behavior
- rotation flag invalidation rules
- line-clear scoring categories
- combo and B2B pipelines
- B2B charge / surge release ordering
- All Clear as a separate attack/cancellation pass
- garbage-row special bonus exact predicate
- opener protection

### Garbage / multiplayer mechanics

- pending garbage packet state
- two-phase interaction + interaction_confirm lifecycle
- cancellation and passthrough acknowledgement behavior
- garbage cap semantics
- garbage ARE and entry ordering
- messiness / hole generation RNG consumption
- separate gameplay RNG streams
- targeting / KO coordination architecture
- remote deterministic replay simulation vs cheap board snapshots
- server-authority boundary inferred from replay/IGE flow

### Replay / state

- replay event categories
- periodic `full` state anchors
- distinction between replay `full` and true deterministic EjectState
- canonical state fields including both RNG seeds
- state overlay/injection boundaries
- rolling replay / network provision behavior
- official solo score submission includes replay rather than trusting final score/time alone

### Rendering behavior needed for a compatible-looking custom client

- PixiJS/WebGL separation from fixed 60Hz physics
- stack/falling/ghost/hold/next dirty-update structure
- board edge topology bytes
- Wang-style connected skin lookup
- real collision/kick functions reused for ghost and previews

### Official solo modes

- exact 40 LINES preset
- exact BLITZ preset
- BLITZ level thresholds and gravity formula
- natural 20G special-path gating

### Deterministic scheduling

- exact high-level per-frame manager order
- event-stream Pull before AdvanceFrame
- typed waiting-frame execution stage
- LIFO ordering for same-target waiting events
- unsafe waiting callbacks identified as runtime plumbing rather than canonical gameplay state

## What is still unknown or intentionally not reconstructed

These are not blockers for a mechanically compatible independent game:

- private TETR.IO matchmaking implementation
- private account / rating / leaderboard databases
- exact server anti-cheat implementation and policy
- whether the production backend literally executes the identical JS build or a source-equivalent shared engine
- private deployment, telemetry and operations infrastructure
- every Zenith / Duo / event-only special modifier
- every custom-game exotic piece / map mutation edge case
- purely cosmetic animation timing and sound behavior

## Remaining uncertainty in the core engine

There will still be small implementation mismatches. Static reverse engineering cannot efficiently eliminate all of them.

The correct next phase is differential testing:

```text
same engine version
same resolved options
same seed
same input events + subframes
        |
        +--> official client oracle
        |
        +--> clean-room implementation

compare canonical state after every simulation frame
```

Recommended comparison order:

1. frame number and piece identity
2. x/y/r/hy and flags
3. board and boardedges
4. hold and bag queues
5. DAS/ARR and held-input state
6. lock timers/resets
7. combo/B2B/score
8. pending garbage and acknowledgements
9. RNG and RNGEX seeds
10. aggregate stats

The first differing field at the first differing frame is the bug localization point.

## Stop condition

The dissection should stop here until there is a concrete product target.

Further static digging now risks spending large amounts of time on TETR.IO-specific private-service glue or rare game-mode branches that may be irrelevant to the intended project. Once the desired product is known, only the subsystems that matter to that product should be implemented and oracle-tested.
