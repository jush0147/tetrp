// Replay documents are data, never executable configuration.
export class ReplayError extends Error {
  constructor(code, path, message) {
    super(`${code} at ${path}: ${message}`); this.name = 'ReplayError';
    this.code = code; this.path = path;
  }
}
const fail = (code, path, message) => { throw new ReplayError(code, path, message); };
const object = (v, p) => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail('MALFORMED', p, 'Expected object'); };
const integer = (v, p) => { if (!Number.isSafeInteger(v) || v < 0) fail('MALFORMED', p, 'Expected nonnegative safe integer'); };
const keys = ['moveLeft','moveRight','rotateCW','rotateCCW','rotate180','softDrop','hardDrop','hold','retry'];
const freeze = v => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
function snapshot(data, path) {
  object(data.game,`${path}.game`); object(data.stats,`${path}.stats`);
  const g=data.game;
  if(!['z','l','o','s','i','j','t'].includes(g.falling?.type))fail('UNSUPPORTED_SCHEMA',path,'Unsupported falling piece');
  if (!Array.isArray(g.board) || !g.board.length || !Array.isArray(g.board[0]) || !g.board[0].length ||
      g.board.some(row=>!Array.isArray(row) || row.length!==g.board[0].length || row.some(c=>c!==null && !['z','l','o','s','i','j','t','gb','gbd'].includes(c)))) fail('MALFORMED',path,'Invalid snapshot board');
  if (!Array.isArray(g.bag) || g.bag.some(p=>!['z','l','o','s','i','j','t'].includes(p))) fail('MALFORMED',path,'Invalid snapshot bag');
  object(g.hold,`${path}.game.hold`); object(g.falling,`${path}.game.falling`);
  if(typeof g.hold.locked!=='boolean' || g.hold.piece!==null && !['z','l','o','s','i','j','t'].includes(g.hold.piece))fail('MALFORMED',path,'Invalid hold');
  if(!Number.isFinite(g.g) || g.g<0 || typeof g.playing!=='boolean')fail('MALFORMED',path,'Invalid gravity/playing');
  for(const key of ['x','r','hy','kick','keys','safelock','locking','lockresets','rotresets','flags','y'])
    if(!Number.isFinite(g.falling[key]))fail('MALFORMED',`${path}.game.falling.${key}`,'Expected finite number');
  if(!Number.isInteger(g.falling.flags) || g.falling.flags<0 || g.falling.flags>=32768)fail('UNSUPPORTED_SCHEMA',path,'Invalid flags');
  for(const key of ['lines','holds','piecesplaced']) integer(data.stats[key],`${path}.stats.${key}`);
}

function stream(value, path) {
  object(value, path); integer(value.frames, `${path}.frames`);
  object(value.options, `${path}.options`);
  if (![15,19].includes(value.options.version)) fail('UNSUPPORTED_VERSION', `${path}.options.version`, 'Expected gameplay v15 or v19');
  if (!Number.isSafeInteger(value.options.seed)) fail('MALFORMED', `${path}.options.seed`, 'Expected safe integer seed');
  object(value.options.handling, `${path}.options.handling`);
  if(value.results!==undefined){
    object(value.results,`${path}.results`);
    if(value.results.stats!==undefined){object(value.results.stats,`${path}.results.stats`);
      for(const k of ['lines','holds','piecesplaced'])integer(value.results.stats[k],`${path}.results.stats.${k}`);
    }
  }
  if (!Array.isArray(value.events) || !value.events.length) fail('MALFORMED', `${path}.events`, 'Expected nonempty events');
  let previous = -1, ended = false;
  const events = value.events.map((e, sourceIndex) => {
    const p = `${path}.events[${sourceIndex}]`;
    object(e,p); integer(e.frame,`${p}.frame`); object(e.data,`${p}.data`);
    if (e.frame < previous) fail('EVENT_ORDER', p, 'Frame regression; events will not be sorted');
    if (e.frame > value.frames || ended) fail('MALFORMED',p,'Event outside stream bounds');
    previous = e.frame;
    if (!['start','full','keydown','keyup','ige','end'].includes(e.type)) fail('UNSUPPORTED_EVENT',p,String(e.type));
    if (e.type === 'start' && (sourceIndex !== 0 || e.frame !== 0)) fail('MALFORMED',p,'Start must be first at frame zero');
    if (sourceIndex === 0 && e.type !== 'start') fail('MALFORMED',p,'Missing start');
    if (e.type === 'keydown' || e.type === 'keyup') {
      for(const key of Object.keys(e.data))if(!['key','subframe','hoisted'].includes(key))fail('UNSUPPORTED_SCHEMA',p,`Unknown input field ${key}`);
      if (!keys.includes(e.data.key)) fail('UNSUPPORTED_KEY',p,String(e.data.key));
      if (!Number.isFinite(e.data.subframe) || e.data.subframe < 0 || e.data.subframe >= 1) fail('MALFORMED',p,'Invalid subframe');
      if ('hoisted' in e.data && typeof e.data.hoisted !== 'boolean') fail('MALFORMED',p,'Invalid hoisted flag');
    }
    if (e.type === 'ige') {
      for(const key of Object.keys(e.data))if(!['id','frame','type','data'].includes(key))fail('UNSUPPORTED_SCHEMA',p,`Unknown IGE field ${key}`);
      if (!['target','allow_targeting','interaction','interaction_confirm'].includes(e.data.type)) fail('UNSUPPORTED_EVENT',p,`ige:${e.data.type}`);
      integer(e.data.id,`${p}.data.id`); integer(e.data.frame,`${p}.data.frame`); object(e.data.data,`${p}.data.data`);
      const d = e.data.data;
      if (e.data.type === 'target' && (!Array.isArray(d.targets) || d.targets.some(t=>!Number.isSafeInteger(t)))) fail('MALFORMED',p,'Invalid targets');
      if (e.data.type === 'allow_targeting' && typeof d.value !== 'boolean') fail('MALFORMED',p,'Invalid targeting flag');
      if (e.data.type.startsWith('interaction')) {
        for(const key of Object.keys(d))if(!['type','amt','gameid','frame','cid','iid','ackiid','x','y','size'].includes(key))fail('UNSUPPORTED_SCHEMA',p,`Unknown interaction field ${key}`);
        if (d.type !== 'garbage') fail('UNSUPPORTED_EVENT',p,`interaction:${d.type}`);
        for (const k of ['amt','gameid','frame','cid','iid','ackiid']) integer(d[k],`${p}.data.data.${k}`);
        if('size' in d && d.size!==1)fail('UNSUPPORTED_SCHEMA',p,'Only unit-size garbage interactions supported');
      }
    }
    if (e.type === 'full' || e.type === 'end' && 'game' in e.data) snapshot(e.data,`${p}.data`);
    if (e.type === 'end') ended = true;
    return { ...e, sourceIndex };
  });
  if (!ended) fail('MALFORMED',path,'Missing end');
  return { ...value, events };
}

/** Parse JSON text; no filesystem, rendering, network, or engine side effects. */
export function parseReplay(text) {
  if (typeof text !== 'string') fail('MALFORMED','$','Expected JSON text');
  let data;
  try { data = JSON.parse(text); } catch { fail('MALFORMED_JSON','$','Invalid JSON'); }
  object(data,'$');
  if (data.version !== 1) fail('UNSUPPORTED_VERSION','$.version','Expected container v1');
  if (!['40l','league'].includes(data.gamemode)) fail('UNSUPPORTED_MODE','$.gamemode',String(data.gamemode));
  object(data.replay,'$.replay');
  const multi = data.gamemode === 'league';
  if (multi && (!Array.isArray(data.replay.rounds) || !data.replay.rounds.length)) fail('MALFORMED','$.replay.rounds','Expected rounds');
  const rounds = (multi ? data.replay.rounds : [[{ ...data.users?.[0], replay:data.replay }]]).map((round,r) => {
    if (!Array.isArray(round) || !round.length) fail('MALFORMED',`rounds[${r}]`,'Expected players');
    return { index:r, players:round.map((player,p) => {
      object(player,`rounds[${r}][${p}]`);
      return { index:p, gamemode:data.gamemode, id:player.id ?? null, username:player.username ?? null,
        stream:stream(player.replay,`rounds[${r}].players[${p}].replay`) };
    }) };
  });
  return freeze({ schema:'tetrp-replay/1', variant:multi?'ttrm':'ttr', gamemode:data.gamemode, rounds });
}

export function selectPlayer(replay, roundIndex = 0, playerIndex = 0) {
  integer(roundIndex,'roundIndex'); integer(playerIndex,'playerIndex');
  const player = replay.rounds?.[roundIndex]?.players[playerIndex];
  if (!player) fail('SELECTION','round/player','Selection out of range');
  return player;
}

/** Lossless source-order envelope. Unresolved semantic events remain explicit. */
export function orderedEvents(player) {
  return freeze(player.stream.events.map(e => e.type === 'keydown' || e.type === 'keyup'
    ? { sourceIndex:e.sourceIndex, frame:e.frame, type:e.type, key:e.data.key,
      subframe:e.data.subframe, ...('hoisted' in e.data ? {hoisted:e.data.hoisted}: {}) }
    : { sourceIndex:e.sourceIndex, frame:e.frame, type:e.type, data:structuredClone(e.data) }));
}
