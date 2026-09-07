import tl from '../03_fixtures/TETRIO_TETRA_LEAGUE_V19_RULESET.json' with { type: 'json' };
import solo from '../03_fixtures/TETRIO_SOLO_MODE_PRESETS_V19.json' with { type: 'json' };

export const defaultHandling = Object.freeze({ arr: 2, das: 10, dcd: 2, sdf: 6, safelock: true, cancel: false, may20g: true, irs: 'tap', ihs: 'tap' });
export function blitzGravity(level) { return (1 / 60) / Math.max(1e-9, 0.65 - (level - 1) * 0.007) ** (level - 1); }
export function blitzLines(level) { return Math.ceil(level * 0.42 * 5); }
export function ruleset(mode = 'tl', overrides = {}) {
  if (!['tl', '40l', 'blitz'].includes(mode)) throw new TypeError('Unsupported mode');
  const base = {
    ...tl.inherited_defaults_relevant_to_versus, ...tl.explicit,
    buffer: 20, mode, hold: true, infinite_hold: false,
    garbageare: 0, garbagearebump: 0, objective_type: null,
  };
  if (mode !== 'tl') {
    Object.assign(base, solo[mode], { gincrease: 0, garbageincrease_per_second: 0 });
    // Solo attack/B2B inherited defaults are not supplied. Do not substitute TL.
  }
  const result = { ...base, ...overrides };
  for (const key of Object.keys(overrides)) if (!(key in base)) throw new TypeError(`Unknown ruleset option: ${key}`);
  if (result.lineclear_are !== 0) throw new Error('Unknown line-clear ARE RNG jitter; nonzero lineclear_are is unsupported');
  for (const [key, expected] of Object.entries({ bagtype: '7-bag', kickset: 'SRS+', passthrough: 'zero', garbagephase_frames: 0, garbagequeue: false, receivemultiplier: 1, cancelmultiplier: 1, messiness_change: 1, messiness_inner: 0, roundmode: 'down', garbageabsolutecap: 0, garbagetargetbonus: 'none', combotable: 'multiplier', garbagecapincrease_per_second: 0 })) {
    if (result[key] !== expected) throw new Error(`Unsupported ruleset option: ${key}`);
  }
  if (!['instant', 'delayed'].includes(result.garbageentry)) throw new Error('Unsupported garbage entry');
  if (!['combo blocking','limited blocking','none'].includes(result.garbageblocking)) throw new Error('Unsupported garbage blocking');
  for (const name of ['g','gincrease','garbagemultiplier','garbageincrease_per_second','garbagecap','garbagecapmax','garbageattackcap','locktime_frames']) {
    if (!Number.isFinite(result[name]) || result[name] < 0) throw new RangeError(`Invalid ${name}`);
  }
  for (const name of ['are','garbageare','garbagearebump','garbagespeed_frames','gmargin_frames','garbagemargin_frames','lockresets','openerphase_pieces']) {
    if (!Number.isInteger(result[name]) || result[name] < 0) throw new RangeError(`Invalid ${name}`);
  }
  return result;
}
