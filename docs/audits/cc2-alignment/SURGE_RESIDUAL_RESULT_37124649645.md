# Surge residual：200 KO 結果

2026-10-03，修復配置覆寫後的 [run 37124649645](https://github.com/jush0147/tetrp/actions/runs/37124649645)，source `c290518d5e28df680a2f3d1194e7301bc1fa81a2`。先前失敗 run 37124362998 沒有 arena，不納入。

## 結論

| 對同一 frozen Legacy | KO 勝–負 | 勝率 |
|---|---|---|
| accepted，重用原控制 | 104–96 | 52% |
| 加入 Surge residual，200 新局 | 101–99 | 50.5% |

100 個 seed clusters 配對、每版兩座位，candidate-minus-accepted = **−1.5 個百分點**；配對 t 近似 95% CI **−10.90～+7.90 個百分點**。未證明改善、傷害或等價。控制結果先前已知，這是後續比較，非獨立確認；也不是兩版直接對打。Legacy 是 Tetrp vendored Kiwi snapshot-v3.2，不是原版 CC2。

保持 accepted：Surge bank leaf 權重 0、Boolean B2B +0.5，其餘參數不變。不採用本候選、不追加樣本或掃其他折價。這個結果只檢驗 `0.5 * floor(chargedBankBaseUnits * publicNextLockMultiplier)` 的 gross asset leaf，不否定所有未實現資產估值方法。

## Correctness 驗收

- 102 jobs 全成功；192 authority transaction fixtures 與 Rust same-state leaf-only／release reset 檢查所在 build step 通過。
- Gate：20/20 frozen accepted 完整 report parity，20 placements、7 Holds，含空／非空 Hold；10 份評分改變，1 份 charged snapshot 的 top-1 改變。不是完全未啟用的候選。
- 200 新局全為 KO，無 simultaneous KO／重打／watchdog／technical failure。
- 175,918 placements、66,389 Holds／reanalyses，242,307 requests；零 fallback、rejected candidate、parity mismatch。依 arena 執行期斷言，piece／pose／cells／spin／lock frame／clear 與 top-1 一致，Hold parity 100%。
- 固定同局同 piece seed、換座位、24 frames/placement、200k nodes、snapshot-only、Tetrp authority；無一般 frame cap。
- 本機重新執行全部結果摘要驗證、配對統計、200 個重用控制逐物件比對、原控制 SHA／環境檢查；核對每個新局 commit、plan hash、Legacy identity、candidate manifest。下載 binary SHA 與配置核對通過，配置唯一變化為 bank weight 0→0.5。
- 本次驗收依逐局 summary 和既有 runtime parity assertions，沒有重新模擬全部 raw traces。詳細計數、雜湊、100 block 統計見同名 JSON。

候選兩座位各勝 52／49 局。第一個 job 到最後完成為 **1 小時 44 分 48 秒**；累計 runner job 時間約 25.40 小時（非帳單用量）。ntfy 通知 step 成功。

## 下一步

第2項的 Boolean ablation、charged-state 診斷與第一個 residual 候選已完成初輪；效益仍未定，不把整個 B2B／Surge 價值問題宣告解決。按既定順序轉第3項 **clear 類型 shaping 家族**：先核对 normal／mini／full-spin 額外 reward 與精確 sent、B2B/combo/PC 的關係，再隔離三表聯合關閉。從原 accepted 出發，不疊加本次 Surge 候選。沒有在本次結果驗收中派送新 arena。
