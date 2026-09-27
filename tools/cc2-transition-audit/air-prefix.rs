// Board-independent empty-air prefix, keyed only by piece and safe boundary.
// All poses above that boundary have identical collisions to an empty board.
// Board-specific kicks and traversal remain in the ordinary movegen below it.
struct AirLaunch { location: PieceLocation, cost: u32, cost_plus_y: u32 }
struct AirPrefix {
    cutoff: i8,
    costs: Box<[u8;4800]>,
    boundary: Vec<(Placement,u32)>,
    launches: Vec<AirLaunch>,
}
fn air_index(p:Placement)->usize {
    (((p.location.y as usize*10+p.location.x as usize)*4+p.location.rotation as usize)*3)+p.spin as usize
}
thread_local! {
    static AIR_PREFIXES:std::cell::RefCell<AHashMap<(Piece,i8),std::sync::Arc<AirPrefix>>>=std::cell::RefCell::new(AHashMap::new());
}
pub fn audit_air_cache_clear(){AIR_PREFIXES.with(|c|c.borrow_mut().clear());}
pub fn audit_air_cache_size()->(usize,usize){AIR_PREFIXES.with(|c|{
    let c=c.borrow();
    (c.len(),c.values().map(|p|4800+p.boundary.capacity()*std::mem::size_of::<(Placement,u32)>()+
        p.launches.capacity()*std::mem::size_of::<AirLaunch>()).sum())
})}
fn air_prefix(piece:Piece,cutoff:i8)->std::sync::Arc<AirPrefix>{
    AIR_PREFIXES.with(|cache|{
        if let Some(p)=cache.borrow().get(&(piece,cutoff)){return p.clone();}
        let p=std::sync::Arc::new(build_air_prefix(piece,cutoff));
        cache.borrow_mut().insert((piece,cutoff),p.clone());p
    })
}
fn build_air_prefix(piece:Piece,cutoff:i8)->AirPrefix{
    assert!((5..21).contains(&cutoff));
    let board=Board::default();let map=CollisionMaps::new(&board,piece);
    let mut queue=BinaryHeap::new();let mut values=AHashMap::new();
    let start=Placement{location:PieceLocation{piece,rotation:Rotation::North,x:4,y:21},spin:Spin::None};
    values.insert(start,0);queue.push(Intermediate{mv:start,soft_drops:0});
    while let Some(expand)=queue.pop(){
        if values.get(&expand.mv).copied()!=Some(expand.soft_drops){continue;}
        let p=expand.mv.location;
        if p.y<=cutoff {continue;}
        let mut update=update_position(&mut queue,&mut values,false,&board);
        update(Placement{location:PieceLocation{y:p.y-1,..p},spin:Spin::None},expand.soft_drops+1);
        if let Some(m)=shift(p,&map,-1){update(m,expand.soft_drops);}
        if let Some(m)=shift(p,&map,1){update(m,expand.soft_drops);}
        if let Some(m)=rotate_cw(p,&map,&board){update(m,expand.soft_drops);}
        if let Some(m)=rotate_ccw(p,&map,&board){update(m,expand.soft_drops);}
        if let Some(m)=rotate_180(p,&map,&board){update(m,expand.soft_drops);}
    }
    let mut result=AirPrefix{cutoff,costs:Box::new([40;4800]),boundary:Vec::new(),launches:Vec::new()};
    for (p,cost) in values{
        if cost>=40 {continue;}
        result.costs[air_index(p)]=cost as u8;
        if p.location.y<=cutoff {result.boundary.push((p,cost));continue;}
        let cost_plus_y=cost+p.location.y as u32;
        if let Some(l)=result.launches.iter_mut().find(|l|l.location.x==p.location.x&&l.location.rotation==p.location.rotation){
            l.cost=l.cost.min(cost);l.cost_plus_y=l.cost_plus_y.min(cost_plus_y);
        }else{result.launches.push(AirLaunch{location:p.location,cost,cost_plus_y});}
    }
    // Stable seeding avoids hash iteration order affecting equal-cost queue ties.
    result.boundary.sort_by_key(|(p,c)|(p.location.x,p.location.y,p.location.rotation as u8,p.spin as u8,*c));
    result.launches.sort_by_key(|l|(l.location.x,l.location.rotation as u8));
    result
}

#[cfg(test)]
mod air_prefix_tests {
    use super::*;
    #[test]
    fn pinned_kicks_and_cells_fit_conservative_margin(){
        let pieces=[Piece::I,Piece::O,Piece::T,Piece::S,Piece::Z,Piece::J,Piece::L];
        let rotations=[Rotation::North,Rotation::East,Rotation::South,Rotation::West];
        for piece in pieces {for from in rotations {for to in rotations {
            for &(_,dy) in crate::srs_plus::kicks(piece,from,to){assert!(dy>=-2);}
            for (_,dy) in to.rotate_cells(piece.cells()){assert!(dy>=-2);}
        }}}
    }
    #[test]
    fn cache_is_bounded_by_piece_and_boundary_and_reuses_entry(){
        audit_air_cache_clear();
        let a=air_prefix(Piece::J,9);let b=air_prefix(Piece::J,9);
        assert!(std::sync::Arc::ptr_eq(&a,&b));assert_eq!(audit_air_cache_size().0,1);
        assert!(a.boundary.iter().all(|(p,c)|p.location.y<=9&&*c<40));
        assert!(a.launches.iter().all(|p|p.location.y>9));
    }
}
