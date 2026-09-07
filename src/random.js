// Original implementation of the specified Park–Miller sequence and bag policy.
const MOD = 2147483647;
export function seedState(seed) {
  if (!Number.isSafeInteger(seed) || seed < 1 || seed >= MOD) {
    throw new RangeError('Seed must be an integer in 1..2147483646');
  }
  return { seed };
}
export function random(state) {
  state.seed = state.seed * 16807 % MOD;
  return (state.seed - 1) / (MOD - 1);
}
export function populateBag(state) {
  const bag = [...'zlosijt'];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random(state.rng) * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  state.queue.push(...bag);
  state.bagId++;
}
export function createBag(seed) {
  const state = { rng: seedState(seed), queue: [], bagId: 0 };
  populateBag(state);
  return state;
}
export function pullBag(state) {
  while (state.queue.length < 14) populateBag(state);
  return state.queue.shift();
}
export function createHoles(seed) {
  return { rng: seedState(seed), lastColumn: null, changed: false };
}
export function completePacket(holes, width = 10) {
  random(holes.rng); // The probability-one test still consumes a draw.
  holes.lastColumn = Math.floor(random(holes.rng) * width);
  holes.changed = true;
}
export function nextHole(holes, width = 10, explicitColumn = null) {
  if (explicitColumn !== null) return explicitColumn;
  if (holes.lastColumn === null) {
    holes.lastColumn = Math.floor(random(holes.rng) * width);
  } else {
    random(holes.rng); // The probability-zero inner test is observable state.
  }
  holes.changed = false;
  return holes.lastColumn;
}
