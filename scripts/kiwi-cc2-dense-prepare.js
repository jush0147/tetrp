// Experimental storage-only transform. The authority/evaluator/DAG are untouched.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export function transformDense(source){
 assert.ok(source.includes('expand.soft_drops + 1'));
 assert.ok(source.includes('fn build_air_prefix('));
 assert.ok(!source.includes('dense_update_position'));
 const split=source.indexOf("fn update_position<'a>");assert.ok(split>0);
 let main=source.slice(0,split);const rest=source.slice(split);
 const helper=rest.slice(0,rest.indexOf('\nfn shift('));
 assert.ok(helper.trimEnd().endsWith('}'));
 function replace(a,b){assert.equal(main.split(a).length,2,a);main=main.replace(a,b);}
 replace('let mut values = AHashMap::new();','let mut values = [40u32; 4800];');
 replace('values.insert(spawned, 0);','values[dense_index(spawned)] = 0;');
 replace('values.get(&expand.mv).copied().unwrap_or(40)','values[dense_index(expand.mv)]');
 const calls=main.match(/update_position\(/g);assert.equal(calls?.length,3);
 main=main.replaceAll('update_position(', 'dense_update_position(');
 const denseHelper=helper.replace("fn update_position<'a>","fn dense_update_position<'a>")
  .replace('AHashMap<Placement, u32>','[u32; 4800]')
  .replace('values.entry(target).or_insert(40)','&mut values[dense_index(target)]');
 assert.ok(!denseHelper.includes('AHashMap'));
 return main+`// CollisionMaps rejects anchors outside x=0..9, y=0..39.
// Piece is fixed for one traversal; orientation and spin remain distinct.
fn dense_index(p: Placement) -> usize {
    assert!((0..10).contains(&p.location.x) && (0..40).contains(&p.location.y));
    assert!((p.location.rotation as usize) < 4 && (p.spin as usize) < 3);
    (((p.location.y as usize * 10 + p.location.x as usize) * 4 + p.location.rotation as usize) * 3) + p.spin as usize
}
`+denseHelper+'\n'+rest+`
#[cfg(test)]
mod dense_visited_tests {
    use super::*;
    #[test]
    fn every_pose_has_one_slot_and_cost_updates_match_hash() {
        let mut seen = [false; 4800];
        let board = Board::default();
        let mut dense = [40u32; 4800]; let mut hash = AHashMap::new();
        let mut dq = BinaryHeap::new(); let mut hq = BinaryHeap::new();
        for y in 0..40 { for x in 0..10 {
            for rotation in [Rotation::North, Rotation::East, Rotation::South, Rotation::West] {
                for spin in [Spin::None, Spin::Mini, Spin::Full] {
                    let p = Placement { location: PieceLocation {piece: Piece::T, x, y, rotation}, spin };
                    let index = dense_index(p); assert!(!seen[index]); seen[index] = true;
                    for cost in [41, 40, 39, 39, 20, 21, 0, 1] {
                        dense_update_position(&mut dq, &mut dense, false, &board)(p, cost);
                        update_position(&mut hq, &mut hash, false, &board)(p, cost);
                        assert_eq!(dense[index], *hash.get(&p).unwrap());
                        assert_eq!(dq.len(), hq.len());
                    }
                }
            }
        }}
        assert!(seen.into_iter().all(|v|v));
        while let Some(d) = dq.pop() {
            let h = hq.pop().unwrap(); assert_eq!(d.mv, h.mv); assert_eq!(d.soft_drops, h.soft_drops);
        }
        assert!(hq.is_empty());
    }
    #[test]
    #[should_panic]
    fn invalid_anchor_does_not_alias_a_legal_pose() {
        dense_index(Placement {location: PieceLocation {piece: Piece::T, x: 10, y: 0, rotation: Rotation::North}, spin: Spin::None});
    }
}
`;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??'.cache/cc2-transition-source',dest=process.argv[3]??'.cache/cc2-dense-results';
 assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'2e243242b674d57491f99b445f75e35fc48a0e26');
 const before=await readFile(`${root}/src/movegen.rs`,'utf8'),after=transformDense(before);
 const hash=s=>createHash('sha256').update(s).digest('hex');
 await mkdir(dest,{recursive:true});await writeFile(`${root}/src/movegen.rs`,after);
 await writeFile(`${dest}/transform.json`,JSON.stringify({before:hash(before),after:hash(after),slots:4800,costType:'u32',unvisited:40,
  scope:'Main traversal visited-cost table only; landing map and air-prefix builder unchanged.'},null,2));
 await writeFile(`${dest}/candidate.patch`,execFileSync('git',['-C',root,'diff'],{encoding:'utf8'}));
}
