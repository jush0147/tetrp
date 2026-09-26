#[cfg(test)]
mod alignment_storage_tests {
    use super::*;
    #[test]
    fn partial_top_and_garbage_provenance_are_clipped() {
        for count in [1,5,9] {
            let mut b=Board::default();
            for x in 0..count {b.cols[x]=1u64<<39;}
            b.garbage_rows=1u64<<39;
            let mut f=Forecast::new_timed(&[(1,0)],20,0,24,0).unwrap();
            f.resolve(&mut b,&[],0);
            assert!(!f.topped_out);assert_eq!(f.remaining(),0);
            assert_eq!(b.cols,[0,1,1,1,1,1,1,1,1,1]);
            assert_eq!(b.garbage_rows,1);
        }
    }
    #[test]
    fn repeated_intake_across_two_locks_stays_within_storage() {
        let mut b=Board::default();b.cols[0]=1u64<<38;b.garbage_rows=1u64<<38;
        let mut f=Forecast::new_timed(&[(10,0)],20,0,24,0).unwrap();
        f.resolve(&mut b,&[],0);assert_eq!(f.remaining(),2);assert_eq!(b.cols[0],0);
        f.resolve(&mut b,&[],0);assert_eq!(f.remaining(),0);
        assert_eq!(b.cols,[0,1023,1023,1023,1023,1023,1023,1023,1023,1023]);
        assert_eq!(b.garbage_rows,1023);
    }
    #[test]
    fn known_separate_bug_failed_insert_consumes_one_pending_line() {
        // Diagnostic characterization, NOT a parity assertion. Authority keeps
        // both lines on failed insertion (see cc2-storage-boundary.test.js).
        let mut b=Board::default();b.cols=[1u64<<39;10];let original=b;
        let mut f=Forecast::new_timed(&[(2,0)],20,0,24,0).unwrap();
        f.resolve(&mut b,&[],0);
        assert!(f.topped_out);assert_eq!(b,original);
        assert_eq!(f.remaining(),1); // deliberately unchanged by clipping patch
        eprintln!("KNOWN_DIVERGENCE failed-insert pending: Rust=1 authority=2");
    }
}
