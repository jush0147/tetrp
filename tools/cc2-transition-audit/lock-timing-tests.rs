#[cfg(test)]
mod alignment_lock_timing_tests {
    use super::*;
    #[test]
    fn arrival_at_decision_boundary_waits_for_next_lock() {
        for ready in [23,24,25] {
            let mut f=Forecast::new_timed(&[(2,ready)],20,0,24,0).unwrap();
            let mut b=Board::default();
            f.resolve(&mut b,&[],0);
            assert_eq!(f.elapsed_frames,24);
            assert_eq!(f.remaining(),if ready==23 {0} else {2});
            f.resolve(&mut b,&[],0);
            assert_eq!(f.elapsed_frames,48);
            assert_eq!(f.remaining(),0);
            assert_eq!(b.cols[1],3); // exactly two lines, never twice
        }
    }
    #[test]
    fn clear_blocks_and_inactive_attack_cancellation_still_works() {
        let mut f=Forecast::new_timed(&[(2,24)],20,0,24,0).unwrap();
        let mut b=Board::default();
        f.resolve(&mut b,&[],1);
        assert_eq!(f.remaining(),2);assert_eq!(b,Board::default());
        f.resolve(&mut b,&[],0);
        assert_eq!(f.remaining(),0);assert_eq!(b.cols[1],3);
        let mut f=Forecast::new_timed(&[(2,24)],20,0,24,0).unwrap();
        let mut b=Board::default();
        f.resolve(&mut b,&[2],1);
        assert_eq!(f.remaining(),0);assert_eq!(f.sent,0);
        f.resolve(&mut b,&[],0);
        assert_eq!(b,Board::default());
    }
}
