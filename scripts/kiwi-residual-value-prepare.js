import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,`anchor: ${a}`);return s.replace(a,b);};
export function transformFreestyle(s,helper){
 const start=s.indexOf('    eval += weights.h6_base_holes_scale');
 const end=s.indexOf('\n    (\n        Eval { value: eval.into() }',start);
 assert.ok(start>0&&end>start);
 const boardScore=s.slice(start,end).replaceAll('state.board','board').replace(/state\s*\n\s*\.board/g,'board');
 assert.ok(!boardScore.includes('state'));
 s=once(s,'    dag: Dag<Eval>,','    dag: Dag<Eval>,\n    #[cfg(residual_value)]\n    residual_supply: Vec<(u32,u32)>,');
 s=once(s,'            dag: Dag::new(root, queue),',`            dag: Dag::new(root, queue),
            #[cfg(residual_value)]
            residual_supply: (0..queue.len()).map(|i| {
                let suffix=&queue[i+1..];
                (suffix.iter().position(|p| *p==Piece::T).map(|p|p as u32+1).unwrap_or(0),suffix.len() as u32)
            }).collect(),`);
 s=once(s,'            let (state, next) = node.state();',`            let (state, next) = node.state();
            #[cfg(residual_value)]
            let residual_supply = if options.root_no_hold_only && !options.speculate {
                Some(*self.residual_supply.get(node.depth()-1).expect("finite public layer"))
            } else { None };`);
 s=once(s,'                            sent_before,\n                        );','                            sent_before,\n                            #[cfg(residual_value)] residual_supply,\n                        );');
 s=once(s,'    sent_before: u32,\n) -> (Eval, Reward) {','    sent_before: u32,\n    #[cfg(residual_value)] residual_supply: Option<(u32,u32)>,\n) -> (Eval, Reward) {');
 s=once(s,'    let cutout_count = state.bag.contains(Piece::T) as usize',`    #[cfg(residual_value)]
    if let Some(supply) = residual_supply {
        return (Eval { value: (eval + residual_board_value(weights, &state, supply)).into() }, Reward { value: reward.into() });
    }
    let cutout_count = state.bag.contains(Piece::T) as usize`);
 return s+`\n#[cfg(residual_value)]\nfn residual_base(weights: &Weights, board: &Board) -> f32 {\n    let mut eval=0.0;\n${boardScore}\n    eval\n}\n`+helper;
}
export function transformForecast(s){return once(s,'    pub fn remaining(&self)->u32',`    #[cfg(residual_value)]
    pub fn residual_due(&self, locks:u32)->u32 {
        let deadline=self.elapsed_frames.saturating_add(self.frames_per_piece.saturating_mul(locks).saturating_sub(1));
        self.packets[..self.len].iter().filter(|p|p.ready_at<=deadline).map(|p|p.lines).sum()
    }
    pub fn remaining(&self)->u32`)+`
#[cfg(all(test,residual_value))]
mod residual_due_tests {
    use super::*;
    #[test]
    fn residual_deadline_inclusive_stationary_and_elapsed(){
        let mut f=Forecast::new_timed(&[(2,0),(3,23),(5,24),(7,47)],0,0,24,0).unwrap();
        assert_eq!(f.residual_due(1),5);assert_eq!(f.residual_due(2),17);
        f.elapsed_frames=24;assert_eq!(f.residual_due(1),17);
        f.frames_per_piece=0;f.elapsed_frames=0;
        assert_eq!(f.residual_due(1),2);assert_eq!(f.residual_due(12),2);
        assert_eq!(f.remaining(),17);
    }
}
`;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=process.argv[2]??'.cache/cc2-wasm-source';
 const file=`${root}/src/bot/freestyle.rs`,raw=await readFile(file);
 assert.equal(createHash('sha256').update(raw).digest('hex'),'9fe27a686c21515eb729af2ec73c4b99cd0ad6201b783fd35319a93c265f03d1');
 const helper=await readFile('tools/cc2-eval-audit/residual_value.rs','utf8');
 await writeFile(file,transformFreestyle(raw.toString().replace(/\r/g,''),helper));
 const forecast=`${root}/src/forecast.rs`;await writeFile(forecast,transformForecast((await readFile(forecast,'utf8')).replace(/\r/g,'')));
}
