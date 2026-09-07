# TETR.IO v19 Bag / HOLD / Spawn Ordering

Clean-room reference derived from the official production client bundle, engine version 19.

## 1. Standard seven-piece domain

Built-in ordinary minotype order is:

```text
[z, l, o, s, i, j, t]
```

For `bagtype = "7-bag"`, `PopulateBag()` copies this array and performs an in-place Fisher-Yates shuffle using the gameplay `rng` Park-Miller generator.

This source-array order matters for deterministic seeded sequences because Fisher-Yates output depends on the starting ordering, even though every bag remains a uniform permutation.

## 2. Fisher-Yates implementation

Equivalent pseudocode:

```text
shuffleArray(a):
    s = len(a)
    while --s:
        t = floor(rng.nextFloat() * (s + 1))
        swap(a[s], a[t])
```

The engine does not use JavaScript `Math.random()` for normal seeded bag generation.

## 3. Bag pre-generation threshold

`PullFromBag()` does not merely refill when empty.

For ordinary modes:

```text
while bag.length < 14:
    PopulateBag()
return bag.shift()
```

For Zenith, the threshold is 6 instead of 14.

Game setup already calls `PopulateBag()` once before the first piece spawns. Therefore for standard 7-bag:

```text
SetOptions:
    bag = first shuffled 7-bag

first Next():
    PullFromBag sees length 7 < 14
    generate second 7-bag
    bag length = 14
    shift current piece
    remaining internal queue length = 13

second Next():
    length 13 < 14
    generate third 7-bag
    length 20
    shift current piece
    remaining length = 19
```

So the deterministic RNG state is intentionally ahead of the currently visible NEXT queue.

A clone that generates a new bag only when the current one reaches zero will show the same piece sequence but will have a different `rng.seed` at intermediate checkpoints. That matters for state serialization / exact replay compatibility.

## 4. Seeded standard-bag examples

Using the exact Park-Miller RNG and built-in minotype ordering:

```text
seed 1:
  bag1 = ojilstz
  bag2 = toljsiz
  bag3 = lisotzj

seed 42:
  bag1 = otiljsz
  bag2 = ijzlost
  bag3 = ijszlot

seed 12345:
  bag1 = lostijz
  bag2 = loztisj
  bag3 = ostzjil

seed 2147483646:
  bag1 = zsioljt
  bag2 = osizjlt
  bag3 = osztijl
```

These are useful as clean-room deterministic test vectors.

## 5. Normal spawn initialization

Ignoring special kickset spawn rotations/offsets, a new piece is initialized approximately as:

```text
piece.type = next_type
piece.r = kickset spawn rotation
piece.x = ceil(boardWidth / 2) - 1 + pieceOffsetX
piece.y = boardBuffer - 2.04 + pieceOffsetY
piece.hy = boardBuffer - 2
```

Then the engine resets:
- rotation/spin state flags
- wall/floor/sleep/nodraw state flags
- force-lock, soft-drop, move, rotate action flags
- finesse key count
- lock timer
- rotation reset count
- lock reset count
- per-piece skip array
- total rotation counter
- hold lock (temporarily false during spawn construction)
- per-piece CW/CCW/180 tracking
- first-input timestamp

It marks falling/NEXT/HOLD render state dirty.

## 6. DCD is applied across the piece transition

Before replacing the old falling-piece fields, `Next()` calls `_InternalDCD()`.

`_InternalDCD()` examines whether the outgoing/old piece has the wall-hit flag. If so, it reduces retained DAS charge according to DCD and resets ARR charge.

Therefore DCD across spawn is explicitly based on the outgoing piece's wall-contact state. A clean-room clone should not clear the old piece flags before applying spawn-transition DCD.

## 7. HOLD while piece is active

Normal active HOLD:

```text
if sleeping:
    handle buffered IHS instead
if holdlocked:
    reject
if HOLD disabled:
    reject

oldCurrent = falling.type
Next(currentHold, transitionFlag, fromHold=true)
play hold/IHS effects
hold = oldCurrent
holdlocked = !infinite_hold
stats.holds++
```

`Next(currentHold, ...)` uses nullish selection:

```text
newType = explicitType ?? PullFromBag()
```

Therefore if HOLD was empty (`null`), the replacement comes from the normal bag. If HOLD contained a piece, swapping it in does not consume the bag.

After `Next()` constructs the replacement piece it temporarily sets `holdlocked=false`; the calling `Hold()` sets the actual post-hold lock state afterward.

## 8. IHS while piece is sleeping

For `ihs = tap`, pressing HOLD while the falling piece is asleep/inside ARE does not swap immediately. It sets the `ACTION_IHS` flag for the upcoming spawn.

For `ihs = hold`, `Next()` reconstructs IHS intent from whether the HOLD input is physically still held at spawn time.

## 9. IRS while piece is sleeping

For `irs = tap`, pressing rotations while sleeping accumulates a pending rotation modulo 4 in `piece.irs`.

For `irs = hold`, immediately before spawn the engine reconstructs the requested rotation from currently held inputs:

```text
irs = 0
if CCW held: irs -= 1
if CW held:  irs += 1
if 180 held: irs += 2
irs = normalized modulo 4
```

This permits combinations of held rotation inputs to algebraically combine.

## 10. IHS takes precedence over IRS

The normal spawn flow is structurally:

```text
capture hold-mode IRS/IHS intent
apply transition DCD from outgoing piece
choose/spawn candidate piece
reset candidate piece state
possibly perform first blockout check

if buffered IHS:
    clear IHS marker
    Hold(ihs=true)
    // Hold recursively spawns the HOLD/bag replacement
    // IRS is then applied to that replacement
    return

if pending IRS != 0:
    Rotate(irs, isIRS=true)
    clear irs

perform final blockout check
continue gameplay
```

Thus if both IHS and IRS are buffered, the piece that ends up active after the HOLD swap receives IRS. The transient piece that existed before IHS is not the final IRS target.

## 11. Spawn blockout check: direct spawn vs ARE spawn

`Next(explicitType, transitionFlag, fromHold)` contains two blockout-check sites.

### Direct spawn (`transitionFlag=false`)

Used by normal zero-ARE immediate piece transition.

The engine performs a blockout/clutch legality check before IHS/IRS, then another after IRS/HOLD resolution.

The first check can perform spawn clutch and bookkeeping. The second check suppresses duplicate clutch bookkeeping for the same transition.

### ARE completion (`transitionFlag=true`)

The waiting-frame `"are"` handler calls:

```text
if nextwilltank:
    TakeAllDamage()
Next(undefined, true)
```

With `transitionFlag=true`, the pre-IHS/IRS blockout check is skipped. The engine resolves buffered IHS/IRS first and then checks the resulting spawned orientation/piece.

Consequently, in modes with nonzero ARE, buffered IRS can rotate a newly spawned piece before the first blockout verdict for that transition. Zero-ARE direct transitions follow the pre-check path first.

Current Tetra League uses `are=0` and `lineclear_are=0`, so standard TL normally uses direct transition rather than the waiting-frame ARE path.

## 12. HOLD-spawn blockout bookkeeping

The recursive spawn caused by HOLD passes `fromHold=true`.

Blockout/clutch legality is still enforced, but clutch counter/display bookkeeping is suppressed for the internal HOLD transition to avoid double-counting the same logical spawn rescue.

## 13. Hold lock lifetime

At each new piece construction, `Next()` resets `holdlocked=false`.

If a HOLD operation caused that spawn, `Hold()` then sets:

```text
holdlocked = !infinite_hold
```

Thus ordinary rules allow exactly one HOLD action per active piece; locking the piece and spawning the next one resets availability.

## 14. 20G spawn adjustment

After blockout / buffered action resolution, engine v17+ checks `Is20G()`.

If true, it immediately calls `SlamToFloor()` on the newly active piece.

Thus 20G grounding occurs after IHS/IRS and final spawn legality resolution, not before them.

## 15. Renderer-facing NEXT behavior

The engine keeps substantially more than the visible `nextcount` in its internal bag queue. `nextcount` controls presentation; it is not the generator-buffer size.

A clone should separate:
- deterministic generator queue / RNG state
- visible NEXT count

rather than equating them.
