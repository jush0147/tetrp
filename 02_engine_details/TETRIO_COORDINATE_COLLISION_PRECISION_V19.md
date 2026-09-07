# TETR.IO v19 coordinate and collision precision

Source basis: behavior traced from the v19 production client in the local standalone package.

## Board coordinates

Default/Tetra League geometry:

- width: 10
- visible height: 20
- buffer height: 20
- total stored rows: 40
- visible rows begin at row index `buffer`

The engine stores falling-piece X as an integer-like board coordinate, but Y is intentionally fractional.

## Spawn position

The default spawn Y is:

`buffer - 2.04 + piece_rotation_offset_y`

For the ordinary SRS+ standard pieces, the additional rotation offsets are zero, so the base is 17.96 on a 20-row buffer.

The spawn X is based on:

`ceil(width / 2) - 1 + rotation_offset_x`

For width 10 with no extra offset this is X=4.

## Collision row quantization

Piece-cell collision maps the floating world Y to a board row with `ceil(y)`.

The same ceiling behavior is used when a locked piece is written into the board and when tile coordinates are projected for several gameplay checks.

This is why replacing the engine with integer-only Y coordinates is not behaviorally equivalent even if normal stacking looks correct.

## Fall precision guards

A fall step is rounded to six decimal places. If the rounded candidate is an exact integer, v19 adds exactly `1e-6`.

A second legality probe uses `currentY + 1`; if that value is exactly integral, v19 subtracts exactly `2e-6`. The move is accepted only when both positions are legal.

These epsilon guards prevent floating-point equality at row boundaries from changing collision/locking behavior.

A clean-room implementation does not need identical source expressions, but it should reproduce the same row-quantization outcomes at integer boundaries.

## Gravity and fractional frame time

Normal fall distance is:

`effective_gravity * frame_fraction`

Input subframes can split a 60 Hz simulation frame, so the frame fraction can be less than 1.0. This means Y can accumulate fractional movement from both gravity and subframe processing.

## Historical lowest Y

The falling piece tracks a historical-lowest Y (`hy`). When a fall reaches a genuinely new lower position, lock-reset counters are reset. Sideways movement/rotation at the same height instead consumes lock resets.

This distinction is important for reproducing move-reset lock delay.

## Lock timer threshold

For engine version >=15, grounded lock time accumulates by fractional frame units. The test is strictly `locking > locktime`, not `>=`.

With the common locktime of 30, the lock threshold is therefore just beyond 30 accumulated simulation-frame units. Subframe contact timing can affect the exact frame in which the threshold is crossed.

Hard drop bypasses waiting for this timer and locks immediately after reaching the floor.

## Rotation/kick Y placement

Kick candidates normally use a Y base equivalent to:

`floor(currentY) + 0.1 + kickY + rotationOffsetDeltaY`

This deliberately places successful kicked positions away from exact integer boundaries.

After excessive rotational stalling (`totalRotations > lockresets + 15`) the engine switches to the unrounded current Y base instead. This works together with the anti-stall/faster-fall path.

## Collision memoization

Legal-position tests are memoized by X, `ceil(Y)` and rotation for the active piece. The memo is explicitly cleared when the board/piece context changes (new/held piece, garbage/line mutations, state injection, etc.).

## Clean-room consequence

To match TETR.IO edge cases, retain floating-point Y and the 60 Hz/subframe model. Do not simplify the core to integer cell steps plus a cosmetic interpolation layer unless differential tests prove the same collision decisions.
