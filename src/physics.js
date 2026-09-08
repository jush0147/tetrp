// Exact v19 formulas from the handoff precision addendum, not client code.
export function fallProbes(y, step) {
  let candidate = Math.round((y + step) * 1e6) / 1e6;
  if (Number.isInteger(candidate)) candidate += 1e-6;
  let probe = y + 1;
  if (Number.isInteger(probe)) probe -= 2e-6;
  return [candidate, probe];
}
export function effectiveGravity(g, glock) {
  return glock <= 0 ? g : glock <= 180 ? (1 - glock / 180) ** 2 * g : 0;
}
export function softDropBudget(g, dt, sdf) { return sdf === 41 ? 400 * dt : Math.max(g * dt * sdf, 0.05 * sdf); }
export function antiStallExtra(lockresets, rotresets, dt, infinite = false) {
  return infinite ? 0 : 0.5 * dt * Math.max(0,rotresets - lockresets - 15);
}
export function kickY(y, kick, offset, lockresets, totalRotations, infinite = false) {
  return (!infinite && totalRotations > lockresets + 15 ? y : Math.floor(y) + 0.1) + kick + offset;
}
