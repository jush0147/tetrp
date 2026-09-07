# TETR.IO v19 Exact Fall / Soft-drop / Anti-stall Semantics

This note closes three precision gaps that were left approximate in the earlier handoff. It is a behavioral clean-room specification for engine version 19. It does not contain or require the official client source.

## 1. Fall candidate epsilon and six-decimal quantization

For one internal downward step of requested distance `step`, starting from `currentY`:

```text
candidateY = round_to_6_decimals(currentY + step)
if candidateY is an exact integer:
    candidateY += 0.000001

probeY = currentY + 1
if probeY is an exact integer:
    probeY -= 0.000002
```

The move is accepted only if the active piece is legal at **both** `candidateY` and `probeY` using the normal collision rule (`ceil(y)` row mapping).

Consequences:

- the positive epsilon is exactly `1e-6`;
- the opposite probe epsilon is exactly `2e-6`;
- `candidateY` is rounded to six decimal places before the integer test;
- `probeY` is based on the pre-step `currentY + 1`, not `candidateY + 1`;
- this second probe prevents a large/fractional step from skipping an occupied row under the engine's `ceil(y)` collision mapping.

Example from `currentY = 17.0`, `step = 1.0`:

```text
candidateY = 18.000001   -> ceil = 19
probeY     = 17.999998   -> ceil = 18
```

Both positions must be legal.

## 2. Base gravity budget

For a public `Fall(dt)` call, where `dt` is measured in simulation-frame units:

```text
budget = effectiveGravity * dt
```

`effectiveGravity` is sampled before the gravity-lock countdown is reduced for that call.

For v19 the gravity-lock interpolation is:

```text
if glock <= 0:
    effectiveGravity = g
else if glock <= 180:
    effectiveGravity = (1 - glock / 180)^2 * g
else:
    effectiveGravity = 0
```

After calculating the initial budget, positive `glock` is reduced by `dt` and clamped at zero.

## 3. Exact v19 soft-drop formula

With soft drop held, engine v19 uses two cases.

### Infinite-SDF sentinel

`SDF = 41` is not a literal 41x multiplier. It is the v15+ infinity sentinel:

```text
budget = 400 * dt
```

### Finite SDF

For any other SDF value in v19:

```text
budget = max(effectiveGravity * dt * SDF, 0.05 * SDF)
```

The important edge case is that the floor term `0.05 * SDF` is **not multiplied by `dt`**.

Therefore at low gravity, splitting one 60 Hz frame into multiple subframe `Fall(dt)` calls can produce more soft-drop displacement budget than one unsplit `Fall(1)` call. This is a call-boundary behavior and must not be normalized away if exact replay reconstruction is required.

Examples with `g = 0.02`, `SDF = 6`, no gravity lock:

```text
Fall(1.0): max(0.02 * 1.0 * 6, 0.30) = 0.30
Fall(0.4): max(0.02 * 0.4 * 6, 0.30) = 0.30
```

## 4. Forced-lock override ordering

After ordinary gravity and soft-drop handling, if the normal lock-reset budget is exhausted **and** the piece cannot legally move down by one row, v19 replaces the current fall budget with:

```text
budget = 20
```

and marks the piece force-lock action flag.

The anti-stall addition described below is evaluated after this replacement.

## 5. Exact rotational anti-stall fall acceleration

The falling piece maintains a per-piece `rotresets` counter. A successful rotation increments it up to a cap of 63. Falling to a genuinely new historical low resets `rotresets` to zero (unless infinite-movement semantics bypass that reset).

For finite movement, extra fall speed activates only when:

```text
rotresets > lockresets + 15
```

The extra budget for a `Fall(dt)` call is exactly:

```text
antiStallExtra = 0.5 * dt * (rotresets - (lockresets + 15))
budget += antiStallExtra
```

With the standard `lockresets = 15`, the threshold is 30:

```text
rotresets = 30 -> extra 0
rotresets = 31 -> extra 0.5 * dt
rotresets = 35 -> extra 2.5 * dt
```

This uses **`piece.rotresets`**, not `totalRotations`.

## 6. Related but distinct kick anti-stall switch

Rotation kick Y placement has a second anti-stall rule using a different counter.

Normally the kick candidate Y base is:

```text
floor(currentY) + 0.1 + kickY + rotationOffsetDeltaY
```

When finite movement is enabled and:

```text
totalRotations > lockresets + 15
```

it switches to:

```text
currentY + kickY + rotationOffsetDeltaY
```

`totalRotations` counts successful rotations for the current piece and resets on `Next()`. Unlike `rotresets`, it is not reset merely because the piece falls to a new historical low.

Do not merge these counters:

- fall-speed anti-stall -> `piece.rotresets`
- kick-Y-base switch -> `totalRotations`

## 7. Fall budget consumption

The final budget is consumed in internal chunks of at most one cell:

```text
while remaining > 0:
    step = min(1, remaining)
    try internalFall(step)
    remaining -= step
```

If an internal step is illegal, normal locking logic runs and no later budget chunks are consumed.

Crossing an integer board row clears retained rotation/spin flags. Soft-drop score is also awarded on those row crossings rather than continuously per fractional distance.

## 8. Clean-room implementation requirement

For Phase 1 conformance, implement these formulas literally at the behavioral level. Do not replace them with a smoother time-scaled approximation. The exact `1e-6`, `2e-6`, `0.05*SDF`, `400*dt`, and `0.5*dt*excessRotresets` values are confirmed for the supplied v19 client.
