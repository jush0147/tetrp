import { Engine } from '../engine.js';
import { createBag } from '../random.js';
import { ruleset, defaultHandling } from '../rules.js';
import { ReplayError, orderedEvents } from './parser.js';

const fail = (path,message) => { throw new ReplayError('UNSUPPORTED_PROFILE',path,message); };
const aliases = {boardbuffer:'buffer',gmargin:'gmargin_frames',garbagemargin:'garbagemargin_frames',
  garbageincrease:'garbageincrease_per_second',garbagecapincrease:'garbagecapincrease_per_second',
  garbagephase:'garbagephase_frames',garbagespeed:'garbagespeed_frames',locktime:'locktime_frames',openerphase:'openerphase_pieces'};
// Presentation/session fields are preserved in metadata, never simulation actions.
const metadata = new Set(`countdown countdown_count countdown_interval precountdown prestart zoominto bgmnoreset neverstopbgm
 slot_counter1 slot_counter2 slot_counter3 slot_counter4 slot_counter5 slot_bar1 slot_bar2 can_retry pro pro_alert pro_retry
 mission mission_type no_mission_sound forfeit_time noextrawidth song latencymode fulloffset fullinterval username
 minoskin boardskin display_username display_zen display_fire display_replay display_next display_hold display_shadow
 noreplay nosound nosiren room_handling_arr room_handling_das room_handling_sdf objective_result`.split(/\s+/));
const neutral = {seed_random:false,shielded:0,usebombs:false,garbagefavor:0,garbageholesize:1,
 messiness_nosame:false,messiness_center:false,messiness_timeout:0,b2bextras:false,
 allclear_b2b_sends:true,allclear_b2b_dupes:false,allclear_charges:false,allow_harddrop:true,
 infinite_movement:false,manual_allowed:false,new_payback:false,can_undo:false,stock:0,infinite_stock:false,
 inverted:false,absolute_lines:false,masterlevels:false,startinglevel:1,levelspeed:1,levelstatic:false,
 levelstaticspeed:10,levelgbase:0.8,levelgspeed:0.007,map:'',room_handling:false,survivalmode:'none',
 survival_messiness:0,survival_layer_amt:10,survival_layer_non:false,survival_layer_min:0,survival_timer_itv:1,
 survival_cap:0,invisible:false,master_invisible:false,void_holes:0,void_holes_hungryness:12,tutorial:false,
 usezenconfig:false,zenlevels:false,zenlevel:1,zenprogress:0,fromretry:false,retryisclear:false,topoutisclear:false,
 zenith:false,zenith_expert:false,zenith_doublehole:false,zenith_volatile:false,zenith_gravity:false,
 zenith_messy:false,zenith_allspin:false,zenith_duo:false,zenith_mods:[],zenith_ally:[],zenith_allyexpert:false,
 zenith_isshadowedside:false,TEMP_zenith_rng:false,TEMP_zenith_grace:'',score:0,garbagecapmargin:0};

export function decodeFlags(flags) {
  if (!Number.isInteger(flags) || flags<0 || flags>=32768) fail('falling.flags','Expected 15-bit flags');
  return {wall:Boolean(flags&64),sleeping:Boolean(flags&128),forceLock:Boolean(flags&2048),softDropped:Boolean(flags&4096),
    spin:flags&8 ? flags&16?'mini':'full' : 'none'};
}
/** Partial canonical projection; display snapshots never invent RNG/totalRotations. */
export function projectAnchor(data, {preSpawn=false, solo=false} = {}) {
  const out={};
  if(data.gameoverreason!==undefined)out.reason=data.gameoverreason;
  if(data.stats) {
    out.stats={};
    for(const [raw,key] of Object.entries({lines:'lines',holds:'holds',piecesplaced:'pieces',level:'level',level_lines:'levelLines'}))
      if(raw in data.stats) out.stats[key]=data.stats[raw];
    if(!solo && 'score' in data.stats) out.stats.score=data.stats.score;
    if(!solo){
      const attack={};
      for(const key of ['combo','btb'])if(key in data.stats)attack[key]=data.stats[key];
      if(Object.keys(attack).length)out.attack=attack;
    }
  }
  const g=data.game;
  if(g) {
    Object.assign(out,{board:{rows:g.board},hold:g.hold,g:g.g,bag:{queue:g.bag}});
    if(!preSpawn){
      out.piece={...decodeFlags(g.falling.flags)};
      for(const [raw,key] of Object.entries({type:'type',x:'x',y:'y',r:'r',hy:'hy',kick:'kick',keys:'keys',safelock:'safelock',locking:'locking',lockresets:'resets',rotresets:'rotationResets'}))
        if(raw in g.falling) out.piece[key]=g.falling[raw];
      out.playing=g.playing;
    }
  }
  return out;
}

/** v19 compatibility behavior for observed v15 solo and v19 1v1 variants. */
export function prepareReplay(player) {
  const stream=player.stream, raw=orderedEvents(player), end=raw.find(e=>e.type==='end');
  const mode=player.gamemode==='league'?'tl':player.gamemode==='40l'?'40l':null;
  if(!mode || mode==='tl' && stream.options.version!==19 || mode==='40l' && stream.options.version!==15)fail('gamemode/version','Unsupported profile combination');
  if (![15,19].includes(stream.options.version)) fail('options.version','Unsupported gameplay version');
  const options={...stream.options,...end.data.options};
  for(const key of Object.keys(stream.options)) if(end.data.options && key in end.data.options && JSON.stringify(stream.options[key])!==JSON.stringify(end.data.options[key])) fail(`options.${key}`,'Initial/end option disagreement');
  const base=ruleset(mode), rules={};
  for(const [key,value] of Object.entries(options)) {
    if(['version','seed','handling','gameid','anchorseed','no_szo','stride'].includes(key)) continue;
    if(metadata.has(key)) continue;
    if(key==='hasgarbage'){if(value!==(mode==='tl'))fail(key,'Mode/garbage disagreement');continue;}
    if(key==='objective_type' && value==='none'){rules.objective_type=null;continue;}
    if(['objective_count','objective_time'].includes(key) && value===0)continue;
    if(key==='levels' && value===false)continue;
    if(key in neutral){if(JSON.stringify(value)!==JSON.stringify(neutral[key]))fail(`options.${key}`,'Unsupported non-neutral feature');continue;}
    const target=aliases[key]??key;
    if(target==='mode')fail(`options.${key}`,'Internal Engine mode is not a replay option');
    if(!Object.hasOwn(base,target))fail(`options.${key}`,'Unknown gameplay option');
    if(typeof value!==typeof base[target] || typeof value==='number' && !Number.isFinite(value))fail(`options.${key}`,'Invalid option type');
    rules[target]=value;
  }
  for(const key of ['anchorseed','no_szo','stride'])if(key in options && typeof options[key]!=='boolean')fail(`options.${key}`,'Expected boolean');
  if(mode==='tl' && options.no_szo)fail('options.no_szo','Only solo initialization covered');
  for(const [key,value] of Object.entries(options.handling)) {
    if(!Object.hasOwn(defaultHandling,key))fail(`handling.${key}`,'Unknown handling option');
    if(typeof value!==typeof defaultHandling[key])fail(`handling.${key}`,'Invalid handling type');
  }
  let engine;
  try {engine=new Engine({mode,seed:options.seed,handling:options.handling,rules});}
  catch(error){fail('options',error.message);}
  const bag=createBag(options.seed);
  if(options.no_szo)while(['s','z','o'].includes(bag.queue[0]))bag.queue.push(bag.queue.shift());
  const preSpawn=structuredClone(engine.state); preSpawn.bag=structuredClone(bag);preSpawn.piece=null;
  engine.state.bag=bag;engine.spawn();engine.trace=[];
  const events=[], targets=new Set(), seen=new Set();
  for(const e of raw){
    const position={frame:e.frame,sourceIndex:e.sourceIndex};
    if(e.type==='start'){events.push({...position,type:'metadata',kind:'start'});continue;}
    if(e.type==='full'){
      const initial=e.frame===0 && e.sourceIndex===1;
      events.push({...position,type:'anchor',boundary:initial?'pre-spawn':'source-event',
        ...(initial?{actual:preSpawn}:{}),expected:projectAnchor(e.data,{preSpawn:initial,solo:mode!=='tl'})});continue;
    }
    if(e.type==='keydown'||e.type==='keyup'){
      if(e.key==='retry'){
        if(mode==='tl')fail(`events[${e.sourceIndex}]`,'Multiplayer retry applicability requires explicit behavior');
        events.push({...position,type:e.type==='keydown'?'terminal':'metadata',reason:'retry',subframe:e.subframe});
      }else events.push(e);
      continue;
    }
    if(e.type==='ige'){
      const d=e.data;
      if(seen.has(d.id)){events.push({...position,type:'metadata',kind:'duplicate-ige',ige:d});continue;}seen.add(d.id);
      if(d.type==='target'){
        if(d.data.targets.length!==1)fail(`events[${e.sourceIndex}]`,'Only 1v1 targeting supported');
        targets.add(d.data.targets[0]);if(targets.size>1)fail('target','Changing target unsupported');
        events.push({...position,type:'metadata',kind:'target',ige:d});
      }else if(d.type==='allow_targeting'){
        if(d.data.value)fail('allow_targeting','Interactive targeting unsupported');
        events.push({...position,type:'metadata',kind:'allow_targeting',ige:d});
      }else{
        if(!targets.has(d.data.gameid))fail('interaction.gameid','Sender is not the single opponent');
        events.push({...position,type:d.type==='interaction'?'receive':'confirm',remoteCid:d.data.cid,
          data:{from:'P2',iid:d.data.iid,ackiid:d.data.ackiid,amt:d.data.amt},correlation:structuredClone(d)});
      }continue;
    }
    if(e.type==='end'){
      events.push({...position,type:'terminal',reason:e.data.gameoverreason??e.data.reason??stream.results?.gameoverreason??'unknown'});
      events.push({...position,type:'anchor',boundary:'terminal',expected:projectAnchor(e.data.game?e.data:{stats:stream.results?.stats},{solo:mode!=='tl'})});
    }
  }
  return {schema:'tetrp-timeline/1',id:`replay-${options.version}-${options.gameid??player.index}`,frames:stream.frames,
    profile:mode==='40l'?'v19-compat-v15-40l/1':'v19-league-1v1/1',options:structuredClone(options),initial:engine.serialize(),events};
}
