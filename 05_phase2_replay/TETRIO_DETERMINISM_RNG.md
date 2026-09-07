# TETR.IO Determinism and RNG Split

Reverse-engineered from the production client bundle in `01_Official_Standalone`.

## 1. PRNG algorithm

The gameplay engine uses its own small deterministic PRNG rather than `Math.random()` for core game randomness.

The implementation is the classic Park-Miller minimal-standard generator:

```text
modulus    = 2147483647
multiplier = 16807

seed = (16807 * seed) mod 2147483647
float = (seed - 1) / 2147483646
```

Seed normalization keeps the internal state in the valid non-zero range.

This makes gameplay randomness deterministic across clients as long as the same seed and the same sequence of RNG calls are used.

## 2. Two independent RNG streams

At game setup TETR.IO constructs two independent generators from the same initial seed:

```text
rng   = PRNG(options.seed)
rngex = PRNG(options.seed)
```

They start with identical state but advance independently.

This is an important architecture detail.

### `rng`: piece/bag randomness

The ordinary bag manager consumes `rng`.

Observed uses include:
- 7-bag shuffle
- 14-bag
- classic/random bag variants
- pairs
- 7+1 / 7+2 / lone-bag variants
- Zenith bag composition

Therefore garbage/mode randomness cannot accidentally perturb the future NEXT sequence merely because it consumed an extra random number.

### `rngex`: auxiliary gameplay randomness

Observed `rngex` consumers include:
- garbage-hole selection
- weighted `garbagefavor` hole selection
- `messiness_change`
- `messiness_inner`
- random attack rounding when `roundmode="rng"`
- survival garbage
- void-hole placement
- several Zenith/mod random choices
- Zenith garbage-ahead generation

This keeps the piece stream isolated from most non-piece randomness.

## 3. Random fractional attack rounding

When:

```text
roundmode = "rng"
```

an attack value `x` is rounded stochastically but deterministically:

```text
base = floor(x)
fraction = x - base
result = base + (rngex.nextFloat() < fraction ? 1 : 0)
```

Example for `3.35`:
- 35% deterministic probability of becoming 4,
- otherwise 3,
- governed by `rngex`, not system randomness.

`roundmode="down"` simply floors the value.

## 4. Random seed creation

If a local game option has:

```text
seed_random = true
```

the game chooses an initial seed with `Math.random()` once:

```text
floor(2147483646 * Math.random() + 1)
```

After that, the actual chosen numeric seed is stored in the game options and core gameplay uses the deterministic PRNGs.

Rolling replay options explicitly force:

```text
seed_random = false
```

so replay playback uses the already-resolved seed instead of rolling a new one.

## 5. Deterministic boundary

For the normal piece stream, the important chain is:

```text
resolved seed
  -> rng
  -> PopulateBag()
  -> bag array
  -> PullFromBag()
```

For garbage/random attack behavior:

```text
same resolved seed
  -> independent rngex
  -> garbage holes / messiness / stochastic rounding / mode randomness
```

Because these streams are independent, deterministic replay does not require every visual/random UI effect to consume random numbers in exactly the same pattern. Core gameplay randomness is insulated from ordinary `Math.random()` effects such as visual particles or holder positioning.

## 6. State restoration nuance

There are two distinct state representations.

### Wire `full` snapshot

The compact periodic replay/network `full` snapshot includes:
- board
- bag
- hold
- falling piece
- handling/control charge
- stats
- etc.

But it does **not** encode the current `rng` or `rngex` internal seed.

Therefore it is not, by itself, a perfect arbitrary-frame deterministic save-state for all future randomness.

### `EjectState()` / overlay state

The richer engine state explicitly converts both PRNG objects to their current integer state:

```text
rng:   state.rng.seed
rngex: state.rngex.seed
```

During restore they are reconstructed as new PRNG instances from those saved seeds.

That form *is* much closer to a genuine deterministic engine checkpoint.

## 7. Replay preprocessing

When TETR.IO preprocesses a replay, it launches the same game engine headlessly, starts from replay options (including the resolved seed), re-simulates the event stream, and every 300 frames records an `EjectState()` snapshot.

That gives the replay viewer/analysis layer proper seek checkpoints containing current RNG states, even though the lightweight rolling `full` events themselves omit those seeds.

This explains why `StripBloat()` can safely remove rolling `full` events from stored replays: they are not the fundamental source of deterministic truth. The event stream + initial options/seed can be re-simulated, and richer checkpoints can be regenerated locally.

## 8. What this means architecturally

The cleanest mental model is:

```text
initial options + seed
        |
        +--> RNG #1 (pieces only-ish) ----> deterministic bag
        |
        +--> RNG #2 (gameplay extras) ----> garbage / rounding / modes
        |
        +--> frame-tagged inputs + IGEs
                    |
                    v
              60 Hz game engine
                    |
                    +--> rendered board
                    +--> replay
                    +--> rolling sync anchors
```

This is a substantially stronger deterministic design than a typical browser game that casually calls `Math.random()` from gameplay code. TETR.IO still uses `Math.random()` for non-core effects and for choosing a fresh initial seed, but the important simulation randomness is explicitly seeded and separated.
