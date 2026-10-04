# 第3項 clear shaping-off：200 KO結果

2026-10-04，[run37173465050](https://github.com/jush0147/tetrp/actions/runs/37173465050)，source `caa64a4c5b5fca8b8d701f5c9b4bf461cecf3c41`。正確性通過，正向點估計但改善尚未證實；保持原accepted，不自動採用、拆表追加或掃權重。

## 結果

| 各對同一frozen Legacy | KO勝–負 | 勝率 |
|---|---|---|
| accepted，原控制重用 | 104–96 | 52% |
| clear-off，200新局 | 112–88 | 56% |

100共同seed blocks，每版兩座位；candidate-minus-accepted **+4pp**，配對t近似95% CI **−5.94～+13.94pp**。控制先前已知，這是探索比較而非獨立確認；不證明增強、退步或等價，也不因此宣稱已強於Legacy。Legacy為Tetrp vendored Kiwi snapshot-v3.2，不是stock CC2。雙方並非各列直接對打。

本候選只將normal_clears、mini_spin_clears、spin_clears三表歸零；移除普通消行負分與Tetris／full-spin正分，沒有移除wasted_t、B2B clear、combo shaping、PC或精確sent。不能把结果歸因某張表，也不能說所有人工消行偏好已證明無用。

## Correctness與artifact驗收

- 102 jobs全部成功；Rust snapshot與720組合full evaluator clear-only Reward delta／PC override／fallback／terminal／leaf不變測試所在build step通過。
- Gate 20/20 frozen accepted完整report parity，20placements、7Holds，空／非空Hold；20份分數改變、3份top1改變。charged top1為0，不是失敗：此非Surge候選，預定門檻是20份中至少1份top1改變。
- 200新局全KO，無simultaneous KO、重打、watchdog、technical failure。
- 195062 placements、76137 Holds＝reanalyses、271199 requests；零fallback、rejected candidate、parity mismatch。依runtime assertions，top1 piece／pose／cells／spin／lock frame／clear及Hold parity 100%，無unsupported-rule或placement certificate failure。
- 同局同piece seed、換座位、24frames/placement、200k nodes、snapshot-only、Tetrp authority、無一般frame cap保持。候選兩座位各56勝。
- 本機重新執行summary規則核驗、100block配對統計；逐物件核200原控制、原控制SHA與committed環境相同；核所有新局commit／planHash／manifest／Legacy identity，下載binary SHA及完整配置只有三表歸零。
- 依逐局summary及既有runtime assertions驗收，沒有本機重新模擬全部raw traces。完整雜湊及每block統計見同名JSON。內部artifact/cfg保留surge-residual名稱，但manifest.variant=clear-off，Boolean=.5、bank=0，沒有啟用Surge residual。

Wall為1h59m13s，累計runner job時間28.69h（非帳單用量）；ntfy step成功。

## 決定與下一步

保持accepted三張表原值。本次正向點估計值得保留於證據表，但CI仍寬；遵守既定停止規則，不追加到顯著。第3項初輪完成且效益未定；下一項固定第4 **back_to_back_clear：1→0**，先核對其觸發條件與PC override，其他參數回到原accepted；之後第5仍是Tetris井深。本次未修改production、未派下一批arena。
