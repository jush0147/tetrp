import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
const [mode,root='.cache/cc2-wasm-source']=process.argv.slice(2);
const tag=code=>`\n// EVAL_OBSERVER_BEGIN\n#[cfg(eval_observer)]\n${code}\n// EVAL_OBSERVER_END\n`;
export function instrument(source){
 let s=source;
 function before(anchor,code){assert.equal(s.split(anchor).length,2,anchor);s=s.replace(anchor,tag(code)+anchor);}
 before('                        let (eval, reward) = evaluate(', '{ crate::eval_observer::set_depth(node.depth()); }');
 before('    // H1: unsafe structure', 'let mut audit_points: Vec<(&str,f32,f32)> = Vec::new();');
 before('    // H1: unsafe structure', 'let audit_board = state.board.cols;');
 for(const [anchor,label] of [
 ['    let legacy_shape = legacy_clear_reward','pending_safety'],
 ['    // H2 is deliberately','legacy_or_s2'],
 ['    // H3 values unrealized','transaction'],
 ['    if info.placement.location.piece == Piece::T','h3_inventory'],
 ['    // H9 uses the real','wasted_t_b2b_softdrop'],
 ['    let cutout_count =','cavity'],
 ['    eval += weights.h6_base_holes_scale','tslot'],
 ['    let mut coveredness =','holes'],
 ['    let (tetris_well_column,','coveredness'],
 ['    let highest_point =','well'],
 ['    let mut row_transitions =','height'],
 ])before(anchor,`{ audit_points.push(("${label}",eval,reward)); }`);
 before('    for _ in 0..cutout_count {','let mut audit_cutouts: Vec<serde_json::Value> = Vec::new();');
 before('        eval += weights.tslot[board.line_clears().count_ones() as usize];',
  '{ audit_cutouts.push(serde_json::json!({"location":location,"lines":board.line_clears().count_ones(),"before":state.board.cols})); }');
 before('    (\n        Eval { value: eval.into() },', `{
        audit_points.push(("transitions",eval,reward));
        crate::eval_observer::observe(audit_board, state, info, cutout_count, audit_cutouts, audit_points);
    }`);
 assert.equal(s.replace(/\n\/\/ EVAL_OBSERVER_BEGIN\n[\s\S]*?\/\/ EVAL_OBSERVER_END\n/g,''),source,'observer must only insert code');
 return s;
}
if(mode==='runner'){
 let lib=await readFile(`${root}/src/lib.rs`,'utf8');assert(!lib.includes('eval_audit_runner'));
 lib+='\n#[cfg(test)]\nmod eval_audit_runner;\n#[cfg(eval_observer)]\nmod eval_observer;\n';
 await writeFile(`${root}/src/lib.rs`,lib);
 for(const f of ['eval_audit_runner','eval_observer'])await copyFile(`tools/cc2-eval-audit/${f}.rs`,`${root}/src/${f}.rs`);
}else if(mode==='instrument'){
 const file=`${root}/src/bot/freestyle.rs`;await writeFile(file,instrument(await readFile(file,'utf8')));
}else if(mode==='smoke'){
 const source=await readFile('.cache/cc2-parameter-audit/src/bot/freestyle.rs','utf8');
 const changed=instrument(source);assert.throws(()=>instrument(changed));
 console.log('Insertion-only observer transform and duplicate-install guard passed. Rust compilation still required.');
}
