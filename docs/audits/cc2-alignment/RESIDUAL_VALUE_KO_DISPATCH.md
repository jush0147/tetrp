# Residual value固定KO比較：已派送

- 2026-10-06：[run37452163955](https://github.com/jush0147/tetrp/actions/runs/37452163955)。
- Source `1962147846d8ba785129f70ceb00b51aae77e2ce`，workflow_dispatch核對in_progress；不代表gate／對戰已完成。
- [固定計畫](RESIDUAL_VALUE_KO_PLAN_2026-10-06.md)：100新seed × seat swap＝200 decisive KO，candidate frozen run37444591656直接對aligned accepted；同局同piece seed、24frames、200k nodes、authority parity、零fallback。
- 使用者明確接受此候選約3%成本例外；不改寫原成本gate未過，不套用其他候選。未改formula／weights／binary。
- gate過後自動有限100 pair jobs，max-parallel16；沒有第二候選或後續批次。不盯跑，完成／失敗ntfy `just_a_kiwi_for_tetrp`，使用者回來再驗收。
- push run37452130192只註冊workflow，job event guard跳過，不是額外200局。
- 本機16checks及frozen真實preflight metadata檢查通過；Linux orchestration smoke在遠端gate驗證。
