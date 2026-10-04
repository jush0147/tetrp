# 井深 0.6：200 KO 驗收與本輪停止

2026-10-04。[run 37200443114](https://github.com/jush0147/tetrp/actions/runs/37200443114)，source `c9feb5a5148b9fe6cd685bc73ebbc5bd0f207f28`。

只改 tetris_well_depth：0.3 → 0.6，其餘 accepted 參數不變。對手是 Tetrp vendored Legacy Kiwi snapshot-v3.2，非 stock CC2。

| 井深係數 | 對 Legacy KO 勝–負 | 相對共用 accepted 控制的勝率差／配對近似95% CI |
|---|---|---|
| 0.3 accepted（重用） | 104–96 | 對照 |
| 0 | 101–99 | −1.5pp；−11.614～+8.614pp |
| 0.6 | 112–88 | +4pp；−5.837～+13.837pp |

100共同seed clusters、各兩座位。0.6有正向點估計但尚未證明改善；同一批seed上多次探索且重用同一控制，不能當獨立確認，也不能把112–88解讀為已顯著勝過Legacy。不能證明井深越大越好或0.6最佳。production與accepted仍維持0.3。

## Correctness

重新計算全部game summary、配對統計，核對source／plan／manifest／完整config／binary SHA256與原始重用control games。200新局皆正常KO；zero technical failures、silent fallback、rejected candidates、parity mismatch、simultaneous-KO retries。

161558 placements、60643 Holds與60643 reanalyses，無terminal Hold；222201 requests；59674 pending snapshots。兩座位候選勝場55／57。

沿用同局同piece seed／換邊／24 virtual frames／200k nodes／PublicSnapshot／Tetrp tl-placement-v1 authority。runtime top-1 pose/cells/spin/lock-frame/clear及Hold parity通過，無unsupported-rule或certificate失敗造成的technical failure。不是24frames真實鍵盤transport證明。本次重驗summary、identity與gate，沒有重新模擬全部raw traces。

Actions Rust/snapshot/same-state tests及配置gate成功；20 frozen control reports、20 placement certificates、7 Holds通過。20 score changes、3 top-1 changes；chargedChangedTop1=0不影響預先規定的整體activation gate。

Result SHA256 `480e4ad0260f154d067c0c2b5e25fb7f8c12672ba30551564e98da5e2263567d`；candidate binary `956e0573bff5e8668455adfa0fd642f9aeb0b06a9bb6e51a8ed7ead8f5ad8e82`。完整機器驗收紀錄見同名JSON。

執行13:48:06～15:34:01 UTC，wall 1小時45分55秒；24.7803 runner-hours非帳單費用。两批共400新KO、333532 placements／125499 Holds，皆zero parity mismatch。

## 決定

**本輪參數盤點完成並停止。** 不自動排combo／其他舊清單，不擴掃井深、不拼接最高分參數、不promotion；本次未新增Actions任務。

清行三表off與井深0.6均為112–88的探索線索，不能據此宣稱相同作用、可相加或聯合更強。若未來選擇確認候選，需另定新seed與固定樣本／採用準則。保留CC2搜尋、另設evaluator仍屬討論方向，不能把本輪結果說成已證明必須重寫或已授權新實驗。
