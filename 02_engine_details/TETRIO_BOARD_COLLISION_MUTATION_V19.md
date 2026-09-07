# TETR.IO v19 Board / Collision / Mutation Spec

Source: behavior reconstructed from the v19 production client bundle in `01_Official_Standalone`.
Purpose: clean-room implementation reference. Names below are semantic names, not claims about original source identifiers.

## 1. Board geometry

For the standard 10x20 game:

- width `W = 10`
- visible height `H = 20`
- hidden buffer `B = 20`
- total stored rows `T = H + B = 40`
- row 0 is the top of the hidden buffer
- row 20 is the first visible row
- row 39 is the bottom row

The board stores at least two parallel matrices:

- `board[row][col]`: mino / garbage content
- `boardEdges[row][col]`: 8-bit connectivity / skin edge metadata

A clean-room engine should keep gameplay occupancy separate from rendering edge metadata even if the renderer is initially simpler.

## 2. Exact occupancy rule

The collision primitive behaves as follows:

```text
occupied(x, y):
    if x < 0 or x >= W: occupied
    if y < 0 or y >= T: occupied
    row = ceil(y)
    if row does not exist: occupied
    return board[row][x] != empty
```

Important consequences:

- both the top and bottom outside the 40-row matrix are hard collision
- fractional Y is discretized with `ceil`, not `floor` or `round`
- `17.00 -> row 17`
- `17.01 -> row 18`
- `17.96 -> row 18`
- therefore the fractional piece-Y system and the tiny epsilon adjustments in falling logic are mechanically significant

The separate inverse/visual occupancy helper uses rounded coordinates instead. Do not substitute that helper for gameplay collision.

## 3. Piece legality

`isLegalAtPos(type, x, y, rotation)`:

1. load the rotated piece definition
2. for every mino, translate from the piece definition's pivot/offset to board coordinates
3. call the gameplay occupancy primitive for each translated cell
4. legal only when all minos are unoccupied

### Collision memo

The client memoizes legality using a compact key derived approximately from:

```text
10 + ceil(y) * (2 * W) + x
```

and stores 2 bits per rotation state.

Notably, the cache key does not include piece type. Correctness relies on the cache being cleared whenever the relevant piece/board context changes.

Clean-room recommendation:

- either reproduce this behavior and its invalidation points exactly for differential compatibility, or
- use a safer cache key containing piece type and all relevant state

For a first correctness implementation, no cache is preferable to a subtly stale cache.

## 4. Locking a tetromino into the stack

When a falling piece is committed:

- its floating Y is mapped with `ceil(pieceY)`
- each mino writes its gameplay color/content to `board`
- each mino writes its connectivity byte to `boardEdges`
- the highest numerical row touched is tracked

The function returns whether the entire locked piece is above the visible boundary:

```text
maxPlacedRow < B
```

That return value feeds the lockout/topout logic described in `TETRIO_CLUTCH_TOPOUT_V19.md`.

## 5. Full-line detection

A row is clearable/full only if **every cell** is:

- non-empty, and
- not `gbd`

Therefore:

```text
10 ordinary minos            -> full / clearable
9 ordinary + 1 gb            -> full / clearable
10 gb                        -> full / clearable
9 ordinary + 1 gbd           -> NOT full
10 gbd                       -> NOT full
```

`gbd` is therefore not merely a differently colored garbage mino. It is an unclearable/permanent board material that participates differently in multiple board predicates.

## 6. Empty-board predicates are not interchangeable

The client has distinct concepts:

### Strict empty
Every cell is empty.

### Empty with permanent material
Every cell is either:

```text
empty or gbd
```

This is the ordinary All Clear-style board predicate used when permanent material exists.

### Empty with unclearable / Zenith semantics
Every row must be one of:

```text
all cells are empty/gbd
OR
all cells are gb/gbd
```

This special predicate allows Zenith-style garbage rows to count as a cleared state under its own rules.

Do not collapse these predicates into one generic `boardIsEmpty()` helper.

## 7. Removing lines

Given a list of clearable row indices:

1. sort indices descending
2. before deletion, patch edge metadata around each removed row
   - row above receives a bottom-edge bit
   - row below receives a top-edge bit
3. remove the rows from both `board` and `boardEdges`
4. remove/update visual actors belonging to those rows
5. prepend fresh empty rows until total height returns to `T`

Fresh rows are:

```text
board:      all empty
boardEdges: all 255
```

### With line-clear ARE
When `lineclear_are > 0`, the board mutation happens immediately, but visual collapse is delayed/animated:

- per-cell clear animation waits are scheduled
- delay contains `rngex` jitter
- an `are_collapse` wait is scheduled

This means enabling line-clear ARE can consume `rngex` for visual timing. A byte-for-byte deterministic port that intends to preserve the exact RNG stream must decide whether to reproduce this coupling.

Current Tetra League uses `lineclear_are = 0`, so this visual RNG coupling does not affect normal TL gameplay.

## 8. Garbage row insertion (`PushLine`)

A garbage row is generated from:

- hole column(s)
- hole size
- positive material (normally `gb`)
- hole/negative material (normally empty)
- edge/connectivity metadata
- insertion mode

Supported insertion positions include semantically:

```text
aboveStack
aboveUnclearable
abovePerma
bottom/default
```

The selected insertion index is based on the first relevant row:

- first occupied row
- first row containing `gbd`
- first row entirely `gbd`
- otherwise total board height

Before insertion:

- the top row is shifted away
- the new garbage row is inserted at `selectedY - 1`
- total stored board height remains constant

The function marks `lastWasAttack = true` and dirties the rendered stack.

### Top-row precondition

Garbage insertion refuses when row 0 is already completely filled.

That is the board's immediate `IsFull()` condition, not a generic test for any occupancy in the top row.

## 9. Garbage pushing a live falling piece

After several external garbage insertion routes, the client clears collision memo state and calls a repair helper for the active falling piece.

If the piece became illegal because the stack rose:

1. test the same piece one row upward
2. if one row upward is legal, move it upward exactly one row
3. if one row upward is still illegal, top out

Because garbage may be inserted one row at a time, repeated garbage rows may repeatedly push the active piece upward one row per insertion.

This is distinct from the spawn-clutch mechanism. Do not reuse the spawn-clutch loop here.

## 10. Continuous garbage ARE

`ProcessGarbageARE` runs late in each simulation frame, after input, falling, and waiting-frame execution.

It does nothing when:

- the game is paused
- the active piece is sleeping
- there are no queued garbage-ARE entries
- current frame is before `garbageARELockedUntil`

Otherwise it processes one queued entry:

```text
check top-row full condition
insert one garbage row
clear collision memo
repair/push active falling piece upward if needed
update tank-related stats/effects
garbageARELockedUntil = currentFrame + garbageARE
```

This ordering matters because the player gets the current frame's input/fall processing before this continuous-garbage insertion stage.

## 11. Immediate top-row check

The board-level top check is specifically:

```text
row0.every(cell != empty)
```

If true, the game triggers a garbage-smash/topout outcome.

A partially occupied row 0 is not enough for this particular check, although piece collision/blockout can still kill the player through other paths.

## 12. Clean-room implementation invariants

A compatible engine should preserve at least these invariants:

1. Board storage height is visible height + buffer height.
2. Gameplay collision uses hard outside bounds and `ceil(y)`.
3. Piece locking uses the same `ceil(y)` discretization.
4. `gb`, `gbd`, ordinary minos, and empty are distinct gameplay materials.
5. `gbd` prevents ordinary full-line detection.
6. All-Clear-related empty predicates remain distinct.
7. Line removal repairs both board data and edge/connectivity metadata.
8. Garbage insertion maintains a fixed total row count by dropping the top row.
9. Garbage-induced active-piece repair moves upward one row per insertion event, not an arbitrary distance in one call.
10. Collision caches are invalidated after every board/piece mutation that can change legality.
11. Continuous garbage ARE executes after player input/falling for that simulation frame.

## 13. High-value differential tests

When a clean-room engine exists, compare it against the official local client with cases around:

- Y = integer - epsilon / exact integer / integer + epsilon
- piece partially above row 0
- piece at row 39 / below row 39
- garbage insertion under an active piece
- multiple one-line garbage insertions in succession
- a full row containing one `gbd`
- All Clear with only `gbd` remaining
- Zenith empty predicate with a complete `gb`/`gbd` row
- line clear adjacent to connected-skin cells
- line clear ARE enabled vs disabled

These are much more likely to expose a false "99% compatible" engine than ordinary flat-stack play.
