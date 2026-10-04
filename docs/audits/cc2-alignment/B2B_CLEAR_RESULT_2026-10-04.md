# 第4項 B2B clear 0／2：結果

2026-10-04。來源commit `d001c11dfb35c0eb5d85b121753bc9a7ee83548c`。

## 強度結果與決定

| back_to_back_clear | 各對同一Legacy的KO勝–負 | 相對accepted差 | 配對近似95% CI |
|---|---|---|---|
| 1（accepted，重用控制） | 104–96 | — | — |
| [0，run37187886430](https://github.com/jush0147/tetrp/actions/runs/37187886430) | 100–100 | −2pp | −12.16～+8.16pp |
| [2，run37187910625](https://github.com/jush0147/tetrp/actions/runs/37187910625) | 95–105 | −4.5pp | −14.18～+5.18pp |

各200新KO，100共同seed blocks／兩座位，控制是原accepted200局；不是各版本直接互打。Legacy為Tetrp vendored Kiwi snapshot-v3.2。CI由100個seed clusters的勝率差計算，不視為200獨立樣本，亦非多重比較校正後的確認證據。

**兩個候選都未證明改善，維持1。** 雖然0與2的點估計均較低，也不足以證明1最佳或此項必需。2-minus-0探索差−2.5pp，CI−11.89～+6.89pp，同樣不能確定優劣。已觀察多個候選及重用control，不能據此自動選最佳值或追加到顯著。

兩版完整配置均只改back_to_back_clear；Boolean=.5、bank=0、三張消行表原值及所有其他accepted參數保持。本結果不是取消／增加實際B2B攻擊，也不是持有B2B的leaf價值測試。

## Correctness與成本

| | 0 | 2 |
|---|---|---|
| jobs | 102全部成功 | 102全部成功 |
| gate frozen report／placements | 20／20 | 20／20 |
| gate Holds／top1改變 | 7／2 | 6／1 |
| 新KO局 | 200 | 200 |
| placements | 168276 | 163746 |
| Holds | 62601 | 61878 |
| 再分析／terminal Hold | 62601／0 | 61877／1 |
| requests | 230877 | 225625 |
| failures／fallback／rejections／parity mismatch | 全0 | 全0 |
| simultaneous KO／重打／watchdog | 全0 | 全0 |
| 候選兩座位勝數 | 48／52 | 50／45 |
| wall | 1h49m42s | 1h43m00s |

合計400新KO、332022 placements、124479 Holds。根據runtime assertions，top1 piece／pose／cells／spin／lock frame／clear及Hold parity 100%；沒有unsupported-rule或placement certificate failure。固定同局piece seed、換邊、24frames/placement、200k nodes、snapshot-only、Tetrp唯一裁判、無一般frame cap均保持。

本機重跑summary／配對統計／verifyReuse，逐物件比較原控制game，核每新game commit／planHash／manifest／Legacy identity、下載binary SHA與完整配置；Rust snapshot及720 same-state B2B-clear-only Reward delta／PC遮蔽／terminal／leaf不變所在build steps成功。兩個gate都有實際top1 activation，非失效候選。驗收主要依逐局summary及runtime斷言，沒有重新模擬所有raw traces。

2版唯一terminal Hold在block2／leg3／seat1（candidate），seed2026160201：Hold後正常topout，該局winner=0、failure=null、parity mismatch=0。死亡後不要求再分析，故Holds=再分析+terminal Holds；不是漏一次placement或技術失敗。額外事件核對見同名JSON的terminalHold欄位。

第二批第一個job在第一批完成3秒後開始。兩批首尾共3h32m45s，累計runner job時間49.40h（非帳單用量）；ntfy steps成功。

## 後續

第4項初輪完成。依最新範圍決定，下一項只剩井深0／0.6（控制0.3），兩候選已離線備好，尚未編譯gate或dispatch。測完井深停止本輪盤點；不自動接combo及其他清單。再以完整證據選單一強化方向與新seed確認。此次只驗收與更新紀錄，production未改、無新Actions任務。
