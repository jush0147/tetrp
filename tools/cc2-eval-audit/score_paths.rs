// Offline only: read completed DAGs. Never select/expand/insert or force Lazy layers.
#[cfg(eval_observer)]
impl<E: Evaluation> LayerCommon<E> {
    fn score_read(&self,state:&GameState)->(E,Option<Piece>,Vec<Child<E>>,bool) {
        self.kind.with(|this|match this.data {
            LayerKind::Known(l)=>{let n=l.states.get(state).expect("missing known trace state");
                (n.eval,Some(l.piece),n.children.as_ref().map(|c|c.to_vec()).unwrap_or_default(),n.children.is_some())},
            LayerKind::Speculated(l)=>{let n=l.states.get(state).expect("missing frontier trace state");
                assert!(n.children.is_none(),"finite-visible trace cannot expand unknown tail");
                (n.eval,None,vec![],false)},
        })
    }
}

#[cfg(eval_observer)]
impl<E: Evaluation> Dag<E> {
    pub fn score_paths(&self,mut describe:impl FnMut(GameState,Piece,Placement,E::Reward)->serde_json::Value)->serde_json::Value {
        use serde_json::json;
        let (_,_,roots,_)=self.top_layer.score_read(&self.root);
        let mut paths=vec![];
        for root in roots {
            let mut layer=&*self.top_layer;
            let mut state=self.root;
            let mut child=root;
            let mut steps=vec![];
            let mut rewards=vec![];
            let (leaf,reason)=loop {
                assert!(steps.len()<6,"beyond visible horizon");
                let (_,next,_,_)=layer.score_read(&state);
                let next=next.expect("cannot trace a hypothetical unknown piece");
                let description=describe(state,next,child.mv,child.reward);
                state.advance(next,child.mv);
                layer=Lazy::get(&layer.next_layer).expect("trace must not allocate a new layer");
                let (value,_,children,expanded)=layer.score_read(&state);
                assert_eq!((value+child.reward).scalar().to_bits(),child.cached_eval.scalar().to_bits(),"cached child/backprop mismatch root={:?} depth={}",root.mv,steps.len()+1);
                steps.push(json!({"next":next,"placement":child.mv,"cachedScore":child.cached_eval.scalar(),"childValue":value.scalar(),"description":description}));
                rewards.push(child.reward);
                if children.is_empty(){break(value,if expanded{"terminal_no_children"}else{"unexpanded_leaf"});}
                assert_eq!(value.scalar().to_bits(),children[0].cached_eval.scalar().to_bits(),"node value differs from best child");
                child=children[0];
            };
            let mut rebuilt=leaf;
            for reward in rewards.into_iter().rev(){rebuilt=rebuilt+reward;}
            assert_eq!(rebuilt.scalar().to_bits(),root.cached_eval.scalar().to_bits(),"root reconstruction mismatch");
            paths.push(json!({"root":root.mv,"score":root.cached_eval.scalar(),"rebuilt":rebuilt.scalar(),"leaf":leaf.scalar(),"leafReason":reason,"steps":steps}));
        }
        json!(paths)
    }
}
