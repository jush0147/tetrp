# 井深 0：200 KO 驗收

2026-10-04。[run 37200417596](https://github.com/jush0147/tetrp/actions/runs/37200417596)，source `c9feb5a5148b9fe6cd685bc73ebbc5bd0f207f28`。

只改 tetris_well_depth：0.3 → 0；其餘 accepted 參數不變。對手為 Tetrp vendored Legacy Kiwi snapshot-v3.2，非 stock CC2。

## 結果

- 候選對 Legacy：101–99；共用 accepted 控制：104–96。
- 勝率差 −1.5 個百分點；100 seed clusters 配對近似 95% CI：−11.614～+8.614 個百分點。
- 200 新 KO，無 simultaneous-KO retry。兩座位候選勝場 48／53。
- 沒有改善證據，也不能證明井深無用、兩者等效或 0.3 最佳。維持 accepted 0.3，不 promotion。
- wall time 1 小時 51 分 23 秒；runner-hours 26.1425，非帳單費用。

## Correctness

重算全部 summary 與配對統計，核對 source、plan、manifest、binary hashes、完整 config 與重用 control games。200 新局皆正常 KO；zero technical failures、silent fallback、rejected candidates、parity mismatch。171974 placements、64856 Holds／reanalyses，無 terminal Hold；236830 requests。

執行沿用同局同 piece seed、換邊、24 virtual frames、200k nodes、PublicSnapshot、Tetrp tl-placement-v1 authority。Top-1 pose/cells/spin/lock-frame/clear 與 Hold runtime parity 全數通過；這不是 24 frames 真實鍵盤可執行性證明。本次驗收 summary 與 gate，沒有重新模擬全部 raw traces。

Actions Rust/snapshot/same-state tests gate 成功；20 frozen control reports、20 placement certificates、5 Holds 通過，20 score changes、5 top-1 changes，證明候選已啟用。

Result SHA256 `c83686f3cc43f1cd6488e50f1bb724dc8079c00699475d8a98dde47860cfa230`；candidate binary `ea0d0ffa29cac083b32b174c85d1d3cf73840209a447eb2bb75f8c1ea0ce4759`。機器驗收紀錄見同名 JSON。

## 剩餘範圍

查詢時井深 0.6 run 37200443114 正在 gate，尚無結果 artifact，不能報成完成。等待原排程 ntfy，不新增任務或持續監看。該批驗收後停止本輪參數盤點。

使用者後續討論了保留 CC2 搜尋、另設 evaluator 的可能性；目前屬方向討論，尚未定義或授權具體替代實驗，不據此開新 run。需避免重新採用已失敗的 Native 靜態安全加眼前攻擊設計而無新證據。
