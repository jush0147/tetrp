/** Exact partial-anchor comparison. Missing fields are never invented. */
const captured = value => value === undefined ? { $missing: true } : structuredClone(value);
export function compareFields(actual, expected, path = '') {
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return [{field:path,expected:captured(expected),actual:captured(actual)}];
    const differences = [];
    if (Array.isArray(expected) && actual.length !== expected.length) differences.push({field:`${path}.length`,expected:expected.length,actual:actual.length});
    for (const key of Object.keys(expected)) differences.push(...compareFields(actual[key],expected[key],path ? `${path}.${key}` : key));
    return differences;
  }
  return Object.is(actual, expected) ? [] : [{field:path,expected:captured(expected),actual:captured(actual)}];
}

export class DivergenceDiagnostics {
  constructor() { this.observations = []; this.first = null; }
  observe(state, expected, {frame=state.frame, sourceIndex=null, boundary='frame-start', exact=false} = {}) {
    const differences = compareFields(state,expected);
    const observation = {frame,placementIndex:state.stats.pieces,sourceIndex,boundary,fields:Object.keys(expected),differences};
    if (differences.length && !this.first) this.first = {
      firstObservedFrame:frame, firstDivergentFrame:exact?frame:null,
      lastMatchingObservation:this.observations.findLast(o=>!o.differences.length) ?? null,
      placementIndex:state.stats.pieces, sourceIndex,boundary,differences,
      limitation:exact?null:'Sparse/partial anchors cannot locate the first divergent frame or validate unobserved fields.',
    };
    this.observations.push(observation); return observation;
  }
}
