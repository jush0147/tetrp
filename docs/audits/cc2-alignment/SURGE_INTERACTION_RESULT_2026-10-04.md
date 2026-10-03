# Boolean × Surge：兩批結果與交互作用

依 SURGE_INTERACTION_PLAN.md 的預定分析，兩批 correctness 通過，但尚未證明改善或交互作用。保持原 accepted，不自動採用、追加樣本或掃權重。

## KO 結果

每列各對相同 frozen Legacy（Tetrp Kiwi snapshot-v3.2，非 stock CC2），同100個seed blocks／兩座位。這不是各列互相直接對戰。

| Boolean | Surge residual weight | KO勝–負 | 相對accepted差 | 配對近似95% CI |
|---|---|---|---|---|
| 0.5 | 0 | 104–96 | 控制 | — |
| 0 | 0 | 100–100 | −2pp | −11.86～+7.86pp |
| 0.5 | 0.5 | 101–99 | −1.5pp | −10.90～+7.90pp |
| **0** | **0.5** | **108–92** | **+2pp** | **−8.16～+12.16pp** |
| **1** | **1** | **108–92** | **+2pp** | **−7.02～+11.02pp** |

兩個新候選各200新KO，控制重用原accepted200局。CI皆按100個seed clusters的兩座位勝率差，用t=1.984計算；非獨立200個樣本比較，非多重比較校正後的確認證據。舊結果已知，不是獨立確認；108–92也不能據此宣稱已強於Legacy。

## 原2×2交互作用

未開residual時，移除Boolean的效果為−2pp；開residual後為+3.5pp。按各共同block計算差中之差，interaction = **+5.5pp**，近似95% CI **−6.78～+17.78pp**。

點估計方向符合「兩者效果會互相影響」的假設，但不確定範圍仍包含零及反方向，尚未證實；不能把這解讀為兩個一起加會更好，這個contrast量測的是residual是否改變移除Boolean的效果。

(1,1)相對(0.5,0.5)為+3.5pp，CI−5.77～+12.77pp，屬探索比較。(1,1)和(0,0.5)總分相同但逐seed結果不同，兩者差CI−9.46～+9.46pp，不能說等價。第二候選同時改兩個數值，不分別歸因任一參數。

## Correctness 與身分核驗

Source均為`08d762d389a082f856a92bce1bbf50b2cc760538`。

| | [boolean-off run37133089622](https://github.com/jush0147/tetrp/actions/runs/37133089622) | [both-one run37133115397](https://github.com/jush0147/tetrp/actions/runs/37133115397) |
|---|---|---|
| jobs | 102全部成功 | 102全部成功 |
| gate完整baseline reports／placements | 20／20 | 20／20 |
| gate Holds／top1 changes（charged） | 8／2（1） | 7／3（1） |
| 新KO局 | 200 | 200 |
| placements | 169302 | 166962 |
| Holds＝reanalyses | 64028 | 63399 |
| requests | 233330 | 230361 |
| technical failures／fallback／rejections／parity mismatches | 全0 | 全0 |
| simultaneous KO／重打／watchdog | 全0 | 全0 |
| 候選兩座位勝數 | 52／56 | 59／49 |
| wall（首job至尾job） | 1h55m26s | 1h44m11s |

兩批合計336264 placements、127427 Holds，依runtime斷言top1 piece／pose／cells／spin／lock frame／clear與Hold parity 100%；無unsupported-rule或certificate failure。規則、same-piece seeds、24frames cadence、200k nodes、snapshot-only、Tetrp裁判及KO-only契約均保持。

本機重新計算全部game summary／統計，逐物件比較重用control，verifyReuse核原控制SHA與committed環境；核每game的commit／planHash／manifest／Legacy identity，下載binary SHA與完整配置唯一預期差異。Rust、same-state單位／Boolean delta／release／terminal測試所在build step均成功；沒有在本機重新模擬全部raw traces。全部四格無重打，共同seed核對通過，可作配對interaction。

第二批首job在第一批完成3秒後開始，符合依序queue。兩批首尾合計3h39m40s；累計runner job時間50.64小時（非帳單用量）。兩批ntfy step成功。

## 決定

這兩個候選均比accepted多4勝，但不足以確認增強。遵守預定停止規則，不因正點估計再追加到顯著，也不丟更多數值組合。Boolean／Surge初輪及已授權兩批完成，結論是效益未定，不能說無用或已充分覆蓋資產價值。下一個預設工作回到第3項clear三表shaping的語意核對與隔離候選；本次只驗收與記錄，未派新arena，production不變。

完整雜湊、每批100block結果與interaction計算輸入見同名JSON。
