// Isolated source transform. Default-off retains the incumbent evaluator.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const [mode='install',root='.cache/cc2-wasm-source']=process.argv.slice(2);
function replace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
export function transformDag(s){return replace(s,'    pub fn depth(&self) -> usize { self.layers.len() }',`    pub fn depth(&self) -> usize { self.layers.len() }
    // The selected node consumes its current known layer on this transition.
    // Count only subsequent publicly supplied layers; stop at unknown frontier.
    pub fn known_piece_count_after(&self, wanted: Piece) -> usize {
        let mut layer: &LayerCommon<E> = &self.layers.last().unwrap().next_layer;
        let mut count = 0;
        while let Some(piece) = layer.kind.piece() {
            count += usize::from(piece == wanted);
            layer = &layer.next_layer;
        }
        count
    }`);}
export function transformFreestyle(s){
 s=replace(s,'            let (state, next) = node.state();',`            let (state, next) = node.state();
            // Snapshot branches set root_no_hold_only for their whole fresh DAG.
            // Generic SevenBag/persistent bot entry points keep the old behavior.
            let visible_t_suffix = if cfg!(snapshot_visible_t) && options.root_no_hold_only && !options.speculate {
                Some(node.known_piece_count_after(Piece::T))
            } else { None };`);
 s=replace(s,'                            sent_before,\n                        );','                            sent_before,\n                            visible_t_suffix,\n                        );');
 s=replace(s,'    sent_before: u32,\n) -> (Eval, Reward) {','    sent_before: u32,\n    visible_t_suffix: Option<usize>,\n) -> (Eval, Reward) {');
 s=replace(s,`    let cutout_count = state.bag.contains(Piece::T) as usize
        + (state.reserve == Piece::T) as usize
        + (state.bag.len() <= 3) as usize;`,`    let cutout_count = tslot_resource_count(&state, visible_t_suffix);`);
 return s+`
// Some(n) is the post-transition known queue suffix; reserve is counted once.
// Empty-Hold reserve denotes active current, occupied-Hold reserve denotes Hold.
fn tslot_resource_count(state: &GameState, known_suffix: Option<usize>) -> usize {
    match known_suffix {
        Some(n) => n + usize::from(state.reserve == Piece::T),
        None => state.bag.contains(Piece::T) as usize
            + (state.reserve == Piece::T) as usize + (state.bag.len() <= 3) as usize,
    }
}
#[cfg(test)]
mod tslot_resource_tests {
    use super::*;
    fn state(hold:Option<&str>)->GameState {
        let start:crate::tbp::Start=serde_json::from_value(serde_json::json!({
            "board":[],"queue":["T","I","T","S","T","J"],"hold":hold,"combo":0,"back_to_back":false
        })).unwrap();
        crate::try_create_bot_with_context(start,std::sync::Arc::new(crate::bot::BotConfig::review_h9_h12()),TetrioRules::default(),false).unwrap().state()
    }
    #[test]
    fn tslot_resource_no_bag_inference_and_count_each_public_t_once(){
        let mut s=state(Some("I"));
        assert_eq!(tslot_resource_count(&s,Some(0)),0);
        assert_eq!(tslot_resource_count(&s,Some(2)),2);
        s.bag=EnumSet::only(Piece::T);assert_eq!(tslot_resource_count(&s,Some(0)),0);
        s.reserve=Piece::T;assert_eq!(tslot_resource_count(&s,Some(2)),3);
        s.hold_is_empty=true;assert_eq!(tslot_resource_count(&s,Some(0)),1);
        s.reserve=Piece::I;assert_eq!(tslot_resource_count(&s,Some(0)),0);
    }
    #[test]
    fn tslot_resource_legacy_formula_preserved(){
        let mut s=state(Some("I"));
        for bits in 1..128u32 {
            s.bag=EnumSet::empty();
            for (i,p) in [Piece::I,Piece::O,Piece::T,Piece::L,Piece::J,Piece::S,Piece::Z].into_iter().enumerate() {
                if bits & (1 << i) != 0 { s.bag.insert(p); }
            }
            for reserve in [Piece::T,Piece::I] {s.reserve=reserve;
                assert_eq!(tslot_resource_count(&s,None),usize::from(s.bag.contains(Piece::T))+usize::from(reserve==Piece::T)+usize::from(s.bag.len()<=3));
            }
        }
    }
    #[test]
    fn tslot_resource_known_layers_stop_before_unknown(){
        let s=state(Some("I"));
        for queue in [vec![Piece::T],vec![Piece::T,Piece::I,Piece::T,Piece::T],vec![Piece::I,Piece::J]] {
            let dag=Dag::<Eval>::new(s,&queue);
            let node=dag.select(false,std::f64::consts::LN_2,std::f64::consts::LN_2).unwrap();
            assert_eq!(node.known_piece_count_after(Piece::T),queue[1..].iter().filter(|&&p|p==Piece::T).count());
        }
    }
    #[test]
    fn tslot_resource_transition_consumes_t_and_preserves_swapped_reserve(){
        for (hold,played,next,remaining_t,expected) in [
            (None,Piece::T,Piece::I,0,0),
            (Some("T"),Piece::T,Piece::I,2,2),
            (Some("I"),Piece::I,Piece::T,0,1),
            (Some("I"),Piece::T,Piece::T,0,0),
        ] {
            let mut s=state(hold);
            let mv=crate::movegen::find_moves_with_clutch(&s.board,played,false)[0].0;
            s.advance(next,mv);
            assert_eq!(tslot_resource_count(&s,Some(remaining_t)),expected);
        }
    }
}
`;
}
if(mode==='install'){
 for(const [path,transform] of [['src/dag.rs',transformDag],['src/bot/freestyle.rs',transformFreestyle]]){
  const file=`${root}/${path}`;await writeFile(file,transform((await readFile(file,'utf8')).replace(/\r/g,'')));
 }
}else if(mode==='smoke'){
 const dag=(await readFile('.cache/cc2-audit-source/src__dag.rs','utf8')).replace(/\r/g,'');
 const free=(await readFile('.cache/cc2-parameter-audit/src/bot/freestyle.rs','utf8')).replace(/\r/g,'');
 transformDag(dag);const changed=transformFreestyle(free);assert.throws(()=>transformFreestyle(changed));
 // Candidate remains compatible with the already-verified diagnostic insertion.
 const {instrument,instrumentContext}=await import('./kiwi-eval-observer-prepare.js');
 instrument(changed);instrumentContext(transformDag(dag),'dag');
 console.log('Candidate transform anchors/default guard/observer compatibility passed; Rust CI required.');
}else throw Error('install | smoke');
