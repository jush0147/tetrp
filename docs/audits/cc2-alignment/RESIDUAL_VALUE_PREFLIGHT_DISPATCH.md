# Residual value 離線gate派送

- 2026-10-06，run [37444591656](https://github.com/jush0147/tetrp/actions/runs/37444591656)。
- Source `bfdbd87806fbc2dc79b1a8a5de606a903d7fc710`，workflow_dispatch核對為in_progress，尚未驗收結果。
- [固定計畫](RESIDUAL_VALUE_PREFLIGHT_PLAN.md)：12 perf +8 Surge public snapshots，off重現accepted、on／trace一致、Hold／placement authority commit、60組交錯cost pairs。成本或activation未過即停止候選；不自動arena／browser／promotion。
- push run37444558573僅註冊workflow，job由event guard跳過，非第二批實驗。
- 單job25分鐘技術上限，完成／失敗ntfy `just_a_kiwi_for_tetrp`。派送後不監看，等使用者回來驗收。
- 推送一度被自動審查擋下；補驗remote為使用者指定的公開jush0147/tetrp、ADMIN權限及僅本次程式／紀錄diff後，相同push成功。沒有繞過審查或改目的地。
