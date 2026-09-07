# Tetrp v19 Handoff Errata / Precision Addendum

Read this file before continuing Phase 1. It supersedes older approximate wording where there is a conflict.

## 1. Exact fall / soft-drop / anti-stall values are now supplied

Use:

- `02_engine_details/TETRIO_FALL_SOFTDROP_ANTISTALL_EXACT_V19.md`
- `03_fixtures/TETRIO_FALL_SOFTDROP_ANTISTALL_TEST_VECTORS_V19.json`
- `04_reference/tetrio_fall_precision_reference.py`

These close the previously approximate values for:

- `+1e-6` fall candidate epsilon;
- `-2e-6` second legality-probe epsilon;
- finite soft-drop `max(effective_g * dt * SDF, 0.05 * SDF)`;
- v19 infinite-SDF sentinel `SDF=41 -> 400 * dt`;
- rotational anti-stall extra fall budget `0.5 * dt * excessRotresets`;
- the distinct `totalRotations` kick-Y-base switch.

## 2. Important spin-flag correction

Older scoring notes incorrectly described the internal `IsSpin()` predicate as normal/full-spin-only.

For v19, a recognized mini sets both the general spin bit and the mini bit. Therefore:

```text
IsSpin()     == true for normal/full AND mini recognized spins
IsSpinMini() == true only when both general-spin and mini bits are set
```

Consequences for current Tetra League:

- a line-clearing mini spin qualifies for the spin-side B2B contribution just like another recognized spin;
- `garbagespecialbonus` also treats a garbage-clearing mini spin as a spin because its condition uses the general spin predicate;
- mini-specific base attack values remain distinct and are still selected via the mini predicate.

The affected prose and the high-level TL reference model in this handoff have been corrected accordingly.
