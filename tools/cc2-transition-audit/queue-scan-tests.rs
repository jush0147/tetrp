#[cfg(test)]
mod alignment_queue_scan_tests {
    use super::*;
    #[test]
    fn partially_tanked_middle_packet_preserves_order_across_two_locks() {
        let mut f=Forecast::new_timed(&[(2,25),(10,0),(3,0)],20,0,24,0).unwrap();
        let mut b=Board::default();f.resolve(&mut b,&[],0);
        assert_eq!(f.remaining(),7);
        assert_eq!(f.packets[..f.len].iter().map(|p|(p.lines,p.hole)).collect::<Vec<_>>(),vec![(2,0),(2,3),(3,6)]);
        assert_eq!(b.cols[9],255);
        f.resolve(&mut b,&[],0);
        assert_eq!(f.remaining(),0);assert_eq!(b.cols[9],32767);
    }
    #[test]
    fn fully_consumed_middle_packet_does_not_skip_its_successor() {
        let mut f=Forecast::new_timed(&[(2,25),(3,0),(4,0)],20,0,24,0).unwrap();
        let mut b=Board::default();f.resolve(&mut b,&[],0);
        assert_eq!(f.len,1);assert_eq!(f.packets[0].lines,2);assert_eq!(f.packets[0].hole,0);
        assert_eq!(b.cols[9],127);
        f.resolve(&mut b,&[],0);
        assert_eq!(f.remaining(),0);assert_eq!(b.cols[9],511);
    }
    #[test]
    fn cancellation_still_consumes_inactive_head_before_active_packets() {
        let mut f=Forecast::new_timed(&[(2,49),(10,0),(3,0)],20,0,24,0).unwrap();
        let mut b=Board::default();f.resolve(&mut b,&[],0);
        f.resolve(&mut b,&[3],1);
        assert_eq!(f.remaining(),4);assert_eq!(f.sent,0);
        assert_eq!(f.packets[..f.len].iter().map(|p|(p.lines,p.hole)).collect::<Vec<_>>(),vec![(1,3),(3,6)]);
        assert_eq!(b.cols[9],255); // clear still blocks tank
    }
}
