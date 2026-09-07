# TETR.IO v19 Solo Mode Mechanics: 40 LINES and BLITZ

Source: official production client bundle from the supplied TETR.IO package, engine version 19.

## 1. 40 LINES exact mode preset

The official solo launcher constructs 40 LINES with these gameplay-significant overrides:

- `seed_random = true`
- `anchorseed = true`
- `g = 0.02`
- `allow180 = true`
- `spinbonuses = "all-mini+"`
- `objective_type = "lines"`
- `objective_count = 40`
- `can_retry = true`
- `nolockout = true`
- handling comes from the player's handling configuration
- SRS+ and other normal defaults are inherited from the engine options

At 60 simulation frames per second, `g = 0.02` is 1.2 cells/second before soft drop.

`nolockout = true` is important: the ordinary hidden-row lockout rule is disabled for official 40 LINES.

The `stride` UI option can additionally set `no_szo`; that changes the initial bag constraint for stride practice and therefore must not be mixed into the ordinary ruleset accidentally.

## 2. BLITZ exact mode preset

The official solo launcher constructs BLITZ with these gameplay-significant overrides:

- `seed_random = true`
- `anchorseed = true`
- `allow180 = true`
- `objective_type = "timed"`
- `objective_time = 120000` ms
- `levels = true`
- `levelspeed = 0.42`
- `levelgbase = 0.65`
- `gravitymay20g = false`
- `can_retry = true`
- `nolockout = true`
- inherited default `levelgspeed = 0.007`
- inherited default `levelstatic = false`
- inherited default `startinglevel = 1`

### Lines needed for each BLITZ level

When non-static levelling is active:

```text
level_lines_needed = ceil(level * levelspeed * 5)
                   = ceil(level * 2.1)
```

Therefore levels begin with 3, 5, 7, 9, 11, ... lines required.

If one clear crosses multiple thresholds, the engine loops and can advance more than one level from that single clear.

### BLITZ gravity formula

On level initialization and every level-up:

```text
g = (1 / 60) /
    max(1e-9, levelgbase - (level - 1) * levelgspeed) ** (level - 1)
```

For official BLITZ:

```text
levelgbase  = 0.65
levelgspeed = 0.007
```

`g` is cells per simulation frame. Multiplying by 60 gives nominal cells/second.

The exact first levels are exported separately in `TETRIO_BLITZ_LEVEL_TABLE_V19.json`.

### Why `gravitymay20g = false` matters

From engine version 18 onward, natural gravity only enters the dedicated `Is20G()` slam path when `gravitymay20g` is enabled. BLITZ explicitly disables it.

This does **not** mean gravity is capped below 20 rows/frame. `Fall()` can still consume a large `g` in repeated <=1-cell internal steps. It only means the special natural-gravity 20G branch is disabled.

Soft drop has a separate check and can still qualify for the 20G path depending on handling (`sdf`, `may20g`).

## 3. Drop scoring precision

`Fall()` clears rotation/spin flags only when the active piece crosses an integer row boundary (`ceil(oldY) != ceil(newY)`).

Soft-drop score is added on those row crossings, not continuously for arbitrary fractional movement.

Hard drop loops `_InternalFall(1)` one cell at a time and adds hard-drop score per successfully traversed cell before locking.

This is another reason a clean-room implementation should preserve the fractional-y model instead of replacing it with an integer-only board position.

## 4. Lock timing

The normal lock counter increments by the subframe delta on engine versions >=15:

```text
locking += delta_subframe
```

and locks when:

```text
locking > locktime
```

not `>= locktime`.

For the usual `locktime = 30`, this boundary detail can matter for exact replay conformance.

## 5. Reimplementation notes

For official-mode compatibility, do not treat 40L and BLITZ as a generic custom game with approximately similar settings. Use explicit mode presets and inherit only the same engine defaults the official launcher inherits.
