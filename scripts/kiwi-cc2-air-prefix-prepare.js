import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.argv[2]??'.cache/cc2-transition-source',dest=process.argv[3]??'.cache/cc2-air-results';
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),'2e243242b674d57491f99b445f75e35fc48a0e26');
let s=await readFile(`${root}/src/movegen.rs`,'utf8');
assert.ok(s.includes('expand.soft_drops + 1'));assert.ok(!s.includes('AUDIT_PROFILE'));
const hash=s=>createHash('sha256').update(s).digest('hex'),before=hash(s);
function replace(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
replace('    let fast_mode = false;',`    let fast_mode = false;
    let height=board.cols.iter().map(|c|64-c.leading_zeros()).max().unwrap_or(0) as i8;
    // Five rows cover tetromino offsets and the largest downward SRS+ kick.
    // High boards and clutch keep the full spawn traversal.
    let air=if height+5<21 {Some(air_prefix(piece,height+5))} else {None};`);
replace('    } else {\n        let mut spawned =',`    } else if let Some(prefix)=air.as_ref() {
        let mut update=update_position(&mut queue,&mut values,false,board);
        for &(p,cost) in &prefix.boundary {update(p,cost);}
        for launch in &prefix.launches {
            let mut location=launch.location;location.y-=location.drop_distance(board);
            let placement=Placement{location,spin:Spin::None};
            let key=Placement{location:location.canonical_form(),..placement};
            let cost=underground_locks.entry(key).or_insert(launch.cost);
            *cost=(*cost).min(launch.cost);
            update(placement,launch.cost_plus_y-location.y as u32);
        }
    } else {
        let mut spawned =`);
replace('        let drop_dist = expand.mv.location.drop_distance(board);',`        if let Some(prefix)=air.as_ref() {
            // These paths were already propagated into the boundary and launch
            // summaries. A cheaper re-entry still takes the ordinary path.
            if expand.mv.location.y>prefix.cutoff && expand.soft_drops>=u32::from(prefix.costs[air_index(expand.mv)]) {continue;}
        }
        let drop_dist = expand.mv.location.drop_distance(board);`);
const helper=await readFile('tools/cc2-transition-audit/air-prefix.rs','utf8');s+='\n'+helper;
await writeFile(`${root}/src/movegen.rs`,s);await mkdir(dest,{recursive:true});
await writeFile(`${dest}/candidate.json`,JSON.stringify({before,after:hash(s),helperHash:hash(helper),
  scope:'Empty-air prefix compression; low stacks only; exact cost parity required; no real input timing claim'},null,2));
await writeFile(`${dest}/candidate.patch`,execFileSync('git',['-C',root,'diff','--','src/movegen.rs'],{encoding:'utf8'}));
