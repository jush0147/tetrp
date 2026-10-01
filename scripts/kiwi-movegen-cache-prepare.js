// Isolated, default-off experiment. Does not edit vendored production artifacts.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,`unique anchor: ${a}`);return s.replace(a,b);};
export function transformMovegen(s){
 assert.ok(!s.includes('mod request_cache'), 'cache transform already applied');
 const signature='pub fn find_moves_with_clutch(board: &Board, piece: Piece, allow_clutch: bool) -> Vec<(Placement, u32)> {';
 s=replace(s,signature,`${signature}
    #[cfg(snapshot_movegen_cache)]
    if let Some(result) = request_cache::lookup(board, piece, allow_clutch) {
        #[cfg(snapshot_cache_verify)]
        assert_eq!(result, find_moves_uncached(board, piece, allow_clutch));
        return result;
    }
    let result = find_moves_uncached(board, piece, allow_clutch);
    #[cfg(snapshot_movegen_cache)]
    request_cache::insert(board, piece, allow_clutch, &result);
    result
}
fn find_moves_uncached(board: &Board, piece: Piece, allow_clutch: bool) -> Vec<(Placement, u32)> {`);
 return s+`
// FIFO eviction, full-key equality, request-local lifetime. No RNG or history.
#[cfg(snapshot_movegen_cache)]
pub(crate) mod request_cache {
    use super::*;
    use std::cell::RefCell;
    use std::collections::{BTreeMap, VecDeque};
    type Key = ([u64; 10], u64, u8, bool);
    const CAP: usize = 512;
    #[derive(Default)]
    struct Cache {
        active: bool, entries: BTreeMap<Key, Vec<(Placement,u32)>>, fifo: VecDeque<Key>,
        // calls, hits, misses, evictions, peak entries, peak payload bytes
        stats: [u64;6], bytes: usize,
    }
    thread_local! {
        static CACHE: RefCell<Cache> = RefCell::new(Cache::default());
        static LAST: RefCell<[u64;6]> = RefCell::new([0;6]);
    }
    fn key(b:&Board,p:Piece,c:bool)->Key {(b.cols,b.garbage_rows,p as u8,c)}
    pub struct RequestGuard;
    impl RequestGuard {
        pub fn new()->Self {
            CACHE.with(|c| {let mut c=c.borrow_mut(); assert!(!c.active,"nested snapshot request");
                *c=Cache::default(); c.active=true;}); Self
        }
    }
    impl Drop for RequestGuard {
        fn drop(&mut self) {CACHE.with(|c| {let mut c=c.borrow_mut();
            LAST.with(|s| *s.borrow_mut()=c.stats); *c=Cache::default();});}
    }
    pub fn lookup(b:&Board,p:Piece,clutch:bool)->Option<Vec<(Placement,u32)>> {
        CACHE.with(|c| {let mut c=c.borrow_mut(); if !c.active {return None;}
            let result=c.entries.get(&key(b,p,clutch)).cloned();
            #[cfg(snapshot_cache_verify)] {c.stats[0]+=1; if result.is_some(){c.stats[1]+=1;}else{c.stats[2]+=1;}}
            result
        })
    }
    pub fn insert(b:&Board,p:Piece,clutch:bool,result:&[(Placement,u32)]) {
        CACHE.with(|c| {let mut c=c.borrow_mut(); if !c.active {return;}
            let k=key(b,p,clutch); if c.entries.contains_key(&k){return;}
            if c.entries.len()==CAP {let old=c.fifo.pop_front().unwrap();
                let removed=c.entries.remove(&old).unwrap();
                c.bytes-=removed.len()*std::mem::size_of::<(Placement,u32)>();
                #[cfg(snapshot_cache_verify)] {c.stats[3]+=1;}
            }
            c.bytes+=result.len()*std::mem::size_of::<(Placement,u32)>();
            c.entries.insert(k,result.to_vec()); c.fifo.push_back(k);
            #[cfg(snapshot_cache_verify)] {
                c.stats[4]=c.stats[4].max(c.entries.len() as u64);
                c.stats[5]=c.stats[5].max(c.bytes as u64);
            }
        });
    }
    #[cfg(snapshot_cache_verify)]
    pub fn last()->[u64;6] {LAST.with(|s| *s.borrow())}
    #[cfg(test)]
    mod tests {
        use super::*;
        #[test]
        fn cache_scope_keys_order_and_capacity() {
            let b=Board::default();
            assert!(lookup(&b,Piece::T,false).is_none());
            {
                let _g=RequestGuard::new();
                let expected=find_moves_uncached(&b,Piece::T,false);
                insert(&b,Piece::T,false,&expected);
                assert_eq!(lookup(&b,Piece::T,false),Some(expected.clone()));
                let mut changed=b;changed.garbage_rows=1;
                assert!(lookup(&changed,Piece::T,false).is_none());
                changed=b;changed.cols[0]=1;
                assert!(lookup(&changed,Piece::T,false).is_none());
                assert!(lookup(&b,Piece::I,false).is_none());
                assert!(lookup(&b,Piece::T,true).is_none());
                for i in 1..=CAP {let mut other=b;other.garbage_rows=i as u64;insert(&other,Piece::T,false,&expected);}
                assert!(lookup(&b,Piece::T,false).is_none());
                CACHE.with(|c| assert_eq!(c.borrow().entries.len(),CAP));
            }
            CACHE.with(|c| {assert!(!c.borrow().active);assert!(c.borrow().entries.is_empty());});
            let _g=RequestGuard::new();assert!(lookup(&b,Piece::T,false).is_none());
        }
        #[test]
        fn cache_hit_ordered_movegen_parity() {
            let _g=RequestGuard::new();
            for p in [Piece::I,Piece::O,Piece::T,Piece::S,Piece::Z,Piece::J,Piece::L] {
                for clutch in [false,true] {
                    let b=Board::default();let a=find_moves_with_clutch(&b,p,clutch);
                    assert_eq!(a,find_moves_with_clutch(&b,p,clutch));
                    assert_eq!(a,find_moves_uncached(&b,p,clutch));
                }
            }
        }
        #[test]
        fn cache_clears_on_parse_error() {
            assert!(crate::snapshot::analyze_text("invalid").is_err());
            CACHE.with(|c| {assert!(!c.borrow().active);assert!(c.borrow().entries.is_empty());});
        }
    }
}
`;
}
export function transformSnapshot(s){
 assert.ok(!s.includes('_cache_request'), 'snapshot transform already applied');
 return replace(s,'pub fn analyze_text(text:&str)->Result<Report,String>{',`pub fn analyze_text(text:&str)->Result<Report,String>{
    #[cfg(snapshot_movegen_cache)]
    let _cache_request = crate::movegen::request_cache::RequestGuard::new();`)+`
#[cfg(all(target_arch="wasm32",snapshot_movegen_cache,snapshot_cache_verify))]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn movegen_cache_stats_json()->String {
    serde_json::to_string(&crate::movegen::request_cache::last()).unwrap()
}
`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const root=process.argv[2]??'.cache/cc2-wasm-source';
 for(const [file,transform] of [['movegen',transformMovegen],['snapshot',transformSnapshot]]){
  const path=`${root}/src/${file}.rs`;await writeFile(path,transform((await readFile(path,'utf8')).replace(/\r/g,'')));
 }
}
