import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export function transformLanding(s){
 assert.ok(s.includes('fn dense_update_position'));
 assert.ok(!s.includes('struct LandingCosts'));
 function replace(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
 replace('let mut underground_locks = AHashMap::new();','let mut underground_locks = LandingCosts::new(piece);');
 replace('let cost=underground_locks.entry(key).or_insert(launch.cost);\n            *cost=(*cost).min(launch.cost);','underground_locks.insert_min(key, launch.cost);');
 replace('let sds = underground_locks.entry(Placement { location: dropped.location.canonical_form(), ..dropped }).or_insert(expand.soft_drops);\n        *sds = expand.soft_drops.min(*sds);','underground_locks.insert_min(Placement { location: dropped.location.canonical_form(), ..dropped }, expand.soft_drops);');
 replace('locks.extend(underground_locks.into_iter());','locks.extend(underground_locks.entries);');
 return s+`
// Fixed piece per invocation. Slots index entries, not costs: every u32 cost,
// including u32::MAX, is valid. Final existing sort determines output order.
struct LandingCosts {
    piece: Piece,
    slots: [u16; 4800],
    entries: Vec<(Placement, u32)>,
}
impl LandingCosts {
    fn new(piece: Piece) -> Self {
        Self { piece, slots: [u16::MAX; 4800], entries: Vec::with_capacity(64) }
    }
    fn insert_min(&mut self, p: Placement, cost: u32) {
        assert_eq!(p.location.piece, self.piece);
        let slot = &mut self.slots[dense_index(p)];
        if *slot == u16::MAX {
            // There are at most 4800 distinct keys, safely below u16::MAX.
            *slot = self.entries.len() as u16;
            self.entries.push((p, cost));
        } else {
            let previous = &mut self.entries[*slot as usize].1;
            *previous = (*previous).min(cost);
        }
    }
}
#[cfg(test)]
mod landing_cost_tests {
    use super::*;
    #[test]
    fn legal_canonical_anchors_fit_dense_domain_and_preserve_cells() {
        let board = Board::default();
        for piece in [Piece::I, Piece::O, Piece::T, Piece::L, Piece::J, Piece::S, Piece::Z] {
            for rotation in [Rotation::North, Rotation::East, Rotation::South, Rotation::West] {
                for x in -3..13 { for y in -3..44 {
                    let p = PieceLocation { piece, rotation, x, y };
                    if p.obstructed(&board) { continue; }
                    let canonical = p.canonical_form();
                    let mut a = p.cells(); let mut b = canonical.cells(); a.sort(); b.sort(); assert_eq!(a, b);
                    assert!(!canonical.obstructed(&board));
                    for spin in [Spin::None, Spin::Mini, Spin::Full] {
                        assert!(dense_index(Placement {location: canonical, spin}) < 4800);
                    }
                }}
            }
        }
    }
    #[test]
    fn all_keys_and_full_u32_cost_range_match_hash_minima() {
        let mut dense = LandingCosts::new(Piece::T); let mut reference = AHashMap::new();
        for y in 0..40 { for x in 0..10 {
            for rotation in [Rotation::North, Rotation::East, Rotation::South, Rotation::West] {
                for spin in [Spin::None, Spin::Mini, Spin::Full] {
                    let p = Placement { location: PieceLocation {piece: Piece::T, x, y, rotation}, spin };
                    for cost in [u32::MAX, u32::MAX - 1, 100, 41, 40, 39, 39, 0, 7] {
                        dense.insert_min(p, cost);
                        let old = reference.entry(p).or_insert(cost); *old = (*old).min(cost);
                        assert_eq!(dense.entries[dense.slots[dense_index(p)] as usize], (p, *old));
                        assert_eq!(dense.entries.len(), reference.len());
                    }
                }
            }
        }}
        assert_eq!(dense.entries.len(), 4800);
        let mut expected: Vec<_> = reference.into_iter().collect();
        let key = |(m, c): &(Placement, u32)| (m.location.x, m.location.y, m.location.rotation as u8, m.spin as u8, *c);
        dense.entries.sort_by_key(key); expected.sort_by_key(key); assert_eq!(dense.entries, expected);
    }
}
`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??'.cache/cc2-transition-source',out=process.argv[3]??'.cache/cc2-landing-results';
 assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'2e243242b674d57491f99b445f75e35fc48a0e26');
 const before=await readFile(`${root}/src/movegen.rs`,'utf8'),after=transformLanding(before),hash=s=>createHash('sha256').update(s).digest('hex');
 await mkdir(out,{recursive:true});await writeFile(`${root}/src/movegen.rs`,after);
 await writeFile(`${out}/transform.json`,JSON.stringify({before:hash(before),after:hash(after),scope:'Landing min-cost map only; dense visited table, heap, geometry and final ordering unchanged'},null,2));
 await writeFile(`${out}/candidate.patch`,execFileSync('git',['-C',root,'diff'],{encoding:'utf8'}));
}
