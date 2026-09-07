# TETR.IO scoring / attack formulas (client build 2026-08-10)

Source: beautified production client bundle from the local standalone package.

## 1. Base line-clear attack table

| Clear | Base attack |
|---|---:|
| Single | 0 |
| Double | 1 |
| Triple | 2 |
| Quad | 4 |
| Penta | 5 |
| T-Spin Mini no-line | 0 |
| Spin no-line | 0 |
| Mini Single | 0 |
| Spin Single | 2 |
| Mini Double | 1 |
| Spin Double | 4 |
| Mini Triple | 2 |
| Spin Triple | 6 |
| Mini Quad | 4 |
| Spin Quad | 10 |
| Spin Penta | 12 |

For clears above 5 lines, the generic branch continues linearly:
- normal: `PENTA + (lines - 5)`
- spin: `TSPIN_PENTA + 2 * (lines - 5)`

## 2. Base score table

| Clear | Score |
|---|---:|
| Single | 100 |
| Double | 300 |
| Triple | 500 |
| Quad | 800 |
| Penta | 1200 |
| T-Spin Mini no-line | 100 |
| Spin no-line | 400 |
| Mini Single | 200 |
| Spin Single | 800 |
| Mini Double | 400 |
| Spin Double | 1200 |
| Mini Triple | 800 |
| Spin Triple | 1600 |
| Mini Quad | 1600 |
| Spin Quad | 2600 |
| Spin Penta | 3200 |

Other score constants:
- B2B score multiplier: `1.5x`
- Combo score increment: `50 * (combo - 1)`
- All Clear score: `3500 * level`
- Soft drop: `1` point per cell
- Hard drop: `2` points per cell

## 3. B2B qualification

A clear contributes to B2B when the engine sets local `a > 0`.
Typical cases:
- Quad or higher line clear
- qualifying spin clear
- optional all-clear B2B contribution depending on mode settings

When a non-B2B line clear occurs, a charged B2B chain can be released as Surge.

## 4. Classic B2B chaining attack bonus

When `b2bchaining` is enabled, the attack bonus is not a fixed table.

```text
x = (btb - 1) * 0.8
bonus = floor(1 + ln(1 + x))
      + ((btb - 1 == 1) ? 0 : (1 + frac(ln(1 + x))) / 3)
```

Constants:
- `BACKTOBACK_BONUS = 1`
- `BACKTOBACK_BONUS_LOG = 0.8`

Approximate bonus values before final garbage rounding:

| B2B state | Bonus |
|---:|---:|
| 2 | 1.000 |
| 3 | 1.652 |
| 4 | 2.408 |
| 5 | 2.478 |
| 6 | 2.537 |
| 7 | 2.586 |
| 8 | 2.629 |
| 9 | 3.334 |
| 10 | 3.368 |
| 11 | 3.399 |
| 12 | 3.428 |

This explains why long B2B is rewarded in step-like logarithmic bands instead of adding exactly +1 every clear.

If `b2bchaining` is disabled but the clear is B2B-eligible, the fallback adds `BACKTOBACK_BONUS` (normally +1), optionally doubled for certain `b2bextras` cases.

## 5. B2B Charge / Surge

When `b2bcharging` is enabled and a non-B2B line clear breaks a sufficiently long chain:

```text
surge = floor(
  (btb - b2bcharge_at + b2bcharge_base)
  * garbagemultiplier
)
```

The surge is split into approximately three packets:

```text
packet1 = round(surge / 3)
packet2 = round(surge / 3)
packet3 = surge - packet1 - packet2
```

Each packet is processed separately through the normal blocking/cancellation path (`FightLines`).

This is strategically important: a nominal 21-line surge is not necessarily a single 21-line hit. It may behave like `7 + 7 + 7`, and each packet can independently cancel pending garbage.

## 6. Combo attack

The engine supports multiple combo systems.

### Multiplier mode

For combo > 1:

```text
attack *= 1 + 0.25 * (combo - 1)
```

Then, for combo > 2, attack is also lower-bounded by:

```text
ln(1 + 1 * (combo - 1) * 1.25)
```

Constants:
- `COMBO_BONUS = 0.25`
- `COMBO_MINIFIER = 1`
- `COMBO_MINIFIER_LOG = 1.25`

The strange name `COMBO_MINIFIER` is inherited from the client; in this branch it participates in the logarithmic floor.

### Table modes

Classic guideline combo table:

```text
[0,1,1,2,2,3,3,4,4,4,5]
```

Modern guideline combo table:

```text
[0,1,1,2,2,2,3,3,3,3,3,3,4]
```

The selected table entry is added to base attack.

## 7. Target bonus

For multiplayer modes with target bonus enabled, the client derives a bonus from enemy count:

| Enemies | Bonus |
|---:|---:|
| 0-1 | 0 |
| 2 | 1 |
| 3 | 3 |
| 4 | 5 |
| 5 | 7 |
| 6+ | 9 |

In `offensive` mode this is added directly to attack. In `defensive` mode it is stored as a cancellation bonus instead.

## 8. Final attack conversion

Conceptually:

```text
rawAttack
  = base clear attack
  + B2B bonus
  + combo contribution
  + target bonus (if offensive)

scaledAttack = rawAttack * garbagemultiplier
roundedAttack = AutoRound(scaledAttack)
```

`AutoRound` supports:
- `down`: floor
- `rng`: stochastic rounding using the deterministic game RNG

After rounding, certain modes can add a `garbagespecialbonus` of +1 for qualifying special clears.

An optional `garbageattackcap` can clamp the result.

## 9. Cancellation: FightLines

Generated attack does not immediately equal garbage sent.

`FightLines(attack)` performs roughly:

1. Add the generated amount to `stats.garbage.attack`.
2. Compute any defensive cancellation bonus.
3. Consume cancellable `garbageareentries` first.
4. Consume `impendingdamage` packets next, one line at a time.
5. Hardened garbage is skipped and cannot be cancelled normally.
6. Remaining attack after cancellation is sent through `Offence()`.

Therefore these values are distinct:

```text
attack generated
!= garbage cancelled
!= garbage sent
!= garbage eventually inserted into opponent board
```

This distinction is central to interpreting spikes and macro play.

## 10. All Clear

All Clear has its own separate path.

Base constants include:
- scoring: `3500 * level`
- generic garbage constant: `10`

However actual garbage sent by All Clear uses the mode option `allclear_garbage`, not simply the generic constant. The client also exposes settings controlling whether an All Clear contributes to B2B, charges B2B, or duplicates B2B behavior.

## 11. Garbage insertion is delayed and packetized

Incoming garbage is represented as structured packets, not merely an integer counter. Packets can carry fields such as:
- amount
- status
- active/queued state
- column
- delay
- hardened state
- sender / interaction id

`TakeAllDamage()` later converts eligible packets into board rows according to garbage cap, garbage entry mode, messiness, column selection and timing.

This is why surviving a large displayed spike is not equivalent to physically receiving that many rows at once.

## 12. Strategic interpretation

The client code strongly supports a macro view of TETR.IO:

- Efficient clears are valuable not only for raw attack, but for cancellation timing.
- Long B2B chains gain nonlinear bonuses and may accumulate a later Surge.
- Breaking B2B can be an intentional timing action rather than automatically a mistake.
- A player's visible spike number mixes offence generated across multiple clears and can hide how much was used defensively.
- Incoming garbage timing, packet structure and cancellation opportunities matter as much as PPS.


## 14. v19 exact clarifications from the call path

### Garbage special bonus

The exact v19 condition is evaluated *after* attack multiplier + `AutoRound` and before optional `garbageattackcap`:

```text
if garbagespecialbonus
   and garbageRowsCleared > 0
   and (lineCount == 4 or IsSpin()):
       attack += 1
```

Important edge cases:
- It is exactly `lineCount == 4`, not `>= 4`.
- The internal general `IsSpin()` predicate is true for both normal/full and mini recognized spins.
- `IsSpinMini()` is the additional discriminator for mini-specific scoring; a mini is not represented as `IsSpin()==false`.
- The third argument passed into the attack function is the count of cleared rows that contained `gb`/`gbd`, so the bonus requires actually clearing at least one garbage row.

For current Tetra League this means a garbage-clearing Quad or any recognized Spin clear, including mini, gets +1 after rounding.

### All Clear ordering

`ClearLines()` performs the ordinary clear path first and the All Clear garbage award second:

```text
fullLines = GetFullLines()
garbageRowsCleared = count rows containing gb/gbd
remove full lines
allClear = board empty according to mode-specific permanent/unclearable rules

AnnounceLines(lineCount, allClear, garbageRowsCleared)
    -> combo/B2B mutation
    -> surge release if chain breaks
    -> ordinary clear attack
    -> FightLines(ordinary attack)

AnnounceClear(allClear)
    -> score All Clear
    -> FightLines(allclear_garbage * multiplier)
```

Thus the All Clear garbage award is a separate cancellation/offence packet *after* the ordinary clear's attack path. It is not simply added to base attack before one `FightLines()` call.

Current Tetra League uses `allclear_garbage=5`, so an AC sends/cancels that 5-line award separately after the normal clear attack.

### All Clear and B2B contribution

At the beginning of the ordinary clear calculation, an All Clear contributes `allclear_b2b` to the B2B contribution count. A Quad or recognized Spin clear (including mini) can independently contribute another +1 in the same placement when `allclear_b2b_dupes=true`.

Current TL inherits `allclear_b2b_dupes=true`, so for example an All Clear Quad can contribute two raw B2B points in one placement: one from AC and one from the Quad qualification.

`allclear_b2b_sends=false` suppresses the ordinary B2B send bonus only in the special case where the placement's entire B2B contribution equals exactly the All Clear contribution. If the placement has an additional Quad/full-spin B2B contribution, the normal B2B send bonus remains eligible.
