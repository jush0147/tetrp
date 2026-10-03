# B2B leaf-off 200新KO dispatch

- Run [37114400655](https://github.com/jush0147/tetrp/actions/runs/37114400655)，已確認in_progress。
- Source `dd177c891c2a6f1484a9db8cb82933571e5c2964`。
- 按[B2B_LEAF_COMMON_PLAN.md](B2B_LEAF_COMMON_PLAN.md)執行；candidate只關has_back_to_back，使用run37105409459已通過artifact，不重編或重跑search gate。
- 100 blocks×2座位=200新candidate對Legacy KO，重用200原accepted控制。simultaneous KO才整block含控制換seed重打。
- 本機11 tests與凍結binary/config/control驗證通過；沒有改production、其他權重、authority或cadence。
- ntfy完成／失敗通知，使用者回報後再核對；不持續poll，不自動下一候選。
- 同時的Phase 1 engine tests run37114400530為標準repo CI，不是第二arena。
