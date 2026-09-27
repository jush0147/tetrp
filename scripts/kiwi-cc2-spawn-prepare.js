import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=process.argv[2]??'.cache/cc2-transition-source';
const dest=process.argv[3]??'.cache/cc2-spawn-results';
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'2e243242b674d57491f99b445f75e35fc48a0e26');
async function edit(file,changes){let s=await readFile(`${root}/${file}`,'utf8');
  for(const [a,b]of changes){assert.equal(s.split(a).length,2,`${file}: ${a}`);s=s.replace(a,b);}
  await writeFile(`${root}/${file}`,s);}
await edit('src/data.rs',[
  ['    pub reserve: Piece,','    pub reserve: Piece,\n    /// True: reserve is the active piece, not an occupied Hold slot. Included in state identity.\n    pub hold_is_empty: bool,'],
  ['        self.bag.remove(next);','        if self.hold_is_empty && placement.location.piece != self.reserve { self.hold_is_empty = false; }\n        self.bag.remove(next);'],
]);
await edit('src/lib.rs',[['    let state = GameState {','    let state = GameState {\n        hold_is_empty,']]);
await edit('src/movegen.rs',[
  ['pub fn find_moves(board:',`/// Checks spawn/clutch geometry directly; does not infer death from search output.
pub fn spawn_available(board: &Board, piece: Piece, allow_clutch: bool) -> bool {
    let collision_map = CollisionMaps::new(board, piece);
    let mut spawned = PieceLocation { piece, rotation: Rotation::North, x: 4, y: 21 };
    while collision_map.obstructed(spawned) {
        if !allow_clutch || spawned.y >= 38 { return false; }
        spawned.y += 1;
    }
    true
}

pub fn find_moves(board:`],
]);
await edit('src/bot/freestyle.rs',[
  ['                    let is_root = node.depth() == 1;',`                    let is_root = node.depth() == 1;
                    // An authority allowlist describes an already-active root pose.
                    // Other roots and all descendants must survive actual current spawn
                    // before Hold can be considered. Empty-Hold normalization persists
                    // in GameState rather than being guessed from depth or piece type.
                    let current = if state.hold_is_empty { state.reserve } else { next };
                    if !(is_root && options.root_legal_placements.is_some()) &&
                        !crate::movegen::spawn_available(&state.board, current, state.rules.clutch && state.combo > 0) {
                        continue;
                    }`],
]);
await edit('src/bot.rs',[
  ['        let info = self.current.advance(self.queue.pop_front()',
   '        if self.hold_is_empty && use_hold { self.current.hold_is_empty = false; }\n        let info = self.current.advance(self.queue.pop_front()'],
  ['        // Check membership before doing arithmetic on untrusted coordinates.',`        if self.options.root_legal_placements.is_none() && !crate::movegen::spawn_available(
            &self.current.board, pieces.current.ok_or("missing current")?, self.current.rules.clutch && self.current.combo > 0) {
            return Err("current spawn is terminal; Hold cannot rescue it".into());
        }
        // Check membership before doing arithmetic on untrusted coordinates.`],
  ['        let allow_clutch = self.current.rules.clutch && self.current.combo > 0;',`        let allow_clutch = self.current.rules.clutch && self.current.combo > 0;
        if self.options.root_legal_placements.is_none() && !crate::movegen::spawn_available(&self.current.board,current,allow_clutch) { return false; }`],
]);
await writeFile(`${root}/src/bot.rs`,await readFile(`${root}/src/bot.rs`,'utf8')+'\n'+await readFile('tools/cc2-transition-audit/spawn-tests.rs','utf8'));
await mkdir(dest,{recursive:true});
await writeFile(`${dest}/candidate.patch`,execFileSync('git',['-C',root,'diff','--','src/data.rs','src/lib.rs','src/bot.rs','src/bot/freestyle.rs','src/movegen.rs'],{encoding:'utf8'}));
