// Diagnostic access to the REAL private movegen rotation functions.
pub fn audit_rotation_probe(board:&Board,from:PieceLocation,direction:u8)->serde_json::Value {
    let map=CollisionMaps::new(board,from.piece);
    if map.obstructed(from) {return serde_json::json!({"error":"input pose obstructed"});}
    let result=match direction {
        1=>rotate_cw(from,&map,board),
        2=>rotate_180(from,&map,board),
        3=>rotate_ccw(from,&map,board),
        _=>return serde_json::json!({"error":"invalid direction"}),
    };
    match result {
        None=>serde_json::json!({"beforeCells":from.cells(),"success":false}),
        Some(p)=>serde_json::json!({"beforeCells":from.cells(),"success":true,"placement":p,"cells":p.location.cells()}),
    }
}
