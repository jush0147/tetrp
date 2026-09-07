# TETR.IO v19 spin classification (client-derived clean-room notes)

Source basis: behavior traced from the v19 production client bundled in the local standalone package. This document describes behavior, not copied source.

## 1. When spin state is computed

Spin classification is evaluated immediately after every successful rotation. The piece stores persistent flags for:

- rotated left/right and 180
- recognized spin
- recognized mini spin
- a separate all-spin fallback flag used by a Zenith Duo path
- successful kick index (0-based among fallback kick entries; raw no-kick success behaves as index 0 for stored state)

A later line clear consumes those stored flags.

## 2. What invalidates a previous spin

A successful horizontal shift clears all rotation/spin flags.

Normal gravity or soft-drop movement clears all rotation/spin flags when the piece crosses into another integer row.

Hard drop does not clear the rotation/spin flags while dropping. Therefore a rotate-then-hard-drop can retain spin status.

A failed horizontal movement into a wall does not clear spin status.

A later successful rotation recomputes and replaces the previous spin classification.

## 3. T-style corner test

The corner-style detector requires all of the following:

1. The piece cannot legally move one row downward.
2. The piece has a successful rotation action in its retained flags.
3. At least three of the four piece-specific corner-test cells are occupied.

For pieces marked mini-capable (T in the built-in rules), two orientation-facing corner cells are distinguished:

- both facing corners occupied -> normal spin
- fewer than both facing corners occupied -> mini

If fallback kick index 3 succeeded, a corner-test mini is promoted to normal.

Because the kick list is tested after the raw rotated position, fallback index 3 corresponds to the final classic SRS 90-degree kick test for the normal JLSTZ table.

## 4. Immobility test

The immobility detector returns spin-capable only if the final piece cannot legally move:

- left
- right
- up
- down

This test is separate from the corner test.

## 5. Built-in spin rule modes

### none
No spin recognition.

### T-spins
Only T is eligible. Uses the corner test. T may be normal or mini.

### T-spins+
Only T is eligible. First uses the corner test. If that fails, immobility is accepted as a mini.

### handheld
T, S, Z, L and J are eligible. Uses the corner-table test, not the generic immobility fallback. T may be mini; the other eligible pieces resolve as normal when recognized.

### all
All built-in piece types are eligible.

- T: corner-test result only. If the T corner test fails, no spin.
- non-T: immobility -> normal spin.

### all+
All built-in piece types are eligible.

- T: use the corner result when available; otherwise immobility -> mini.
- non-T: immobility -> normal.

### all-mini
All built-in piece types are eligible.

- T: corner-test result only. If T corner test fails, no spin.
- non-T: immobility -> mini.

### all-mini+
This is the current Tetra League / 40L default in the inspected v19 client.

- T: use the corner result when available; otherwise immobility -> mini.
- non-T: immobility -> mini.

The practical meaning of the plus sign here is important: compared with all-mini, it adds the T-piece immobility fallback. It is not an attack bonus.

### mini-only
All eligible spins become mini. For T, a successful corner result is forced to mini; if the corner result fails, immobility may still produce mini. Non-T immobility also produces mini.

### stupid
All eligible pieces count as a normal spin whenever they are grounded (cannot move down). Rotation and immobility are not required by this mode's recognition branch.

## 6. Current Tetra League consequence

With `spinbonuses=all-mini+`:

- normal T-spin: corner rule says normal
- mini T-spin: corner rule says mini
- T immobility that fails the corner rule: mini
- I/J/L/S/Z/O immobility after a retained successful rotation: mini

The piece must still retain its rotation/spin flags until lock. A real horizontal shift or normal vertical row crossing after the rotation invalidates them.

## 7. Flag semantics warning

The internal `IsSpin()`-style predicate is true for both normal and mini recognized spins. Mini is an additional bit, not a mutually exclusive replacement.

For clean-room code, model this as an enum (`none`, `mini`, `normal`) or two booleans (`spin`, `mini`) with the invariant `mini => spin`.

## 8. Data artifacts

See:

- `TETRIO_SPIN_RULE_TABLES_V19.json` for the extracted piece eligibility and corner tables.
- `TETRIO_SRSPLUS_KICKS_V19.json` for the SRS+ kick tables used by the inspected client.
