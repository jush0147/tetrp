# wasted_t off：固定 200 KO 結果

Run [37098444257](https://github.com/jush0147/tetrp/actions/runs/37098444257)，source `238f807eaa6acaf6d8301913c5f265bf883d01c3`。102 jobs 全部成功；wall 1h46m04s，job durations 合計約24.78 runner-hours（不是帳單計量）。數值與100個配對區塊見 [JSON](WASTED_T_RESULT_37098444257.json)。

## 結論

| 對同一 frozen Legacy | 勝–敗 | KO 勝率 |
|---|---:|---:|
| accepted，wasted_t=-1.5 | 104–96 | 52% |
| candidate，wasted_t=0 | 99–101 | 49.5% |

Candidate-minus-accepted −2.5 percentage points；100 seed blocks（每版兩個座位）的配對近似95% CI為 −13.09～+8.09 percentage points。34 blocks偏向accepted、31偏向candidate、35相同。

**效益未定。** 沒有改善證據，也不能證明關閉有害、兩版等價或此項無用。保持wasted_t=-1.5，不promotion、不追加到顯著。這也不是最佳權重證據。

本次只跑200個新candidate KO；控制組重用run37026070707的全部200個accepted KO，逐block物件與原artifact核對一致。對手是Tetrp既有vendored Kiwi snapshot-v3.2，不是原版CC2。控制組結果先前已知，因此屬後續比較，不是全新獨立確認。

## Correctness

- 200新局全以KO結束；100 blocks無simultaneous KO、重打或watchdog。
- 167854 placements、63389 Holds、63389 reanalyses，terminal Holds=0；231243 requests。
- technical failure、silent fallback、parity mismatch、unsupported-rule/certificate rejection均為0；top-1、Hold、spin、cells、lock frame、clear契約通過。
- 同局同piece seed、交換seat、24 virtual frames/placement、相同200k search nodes/request、PublicSnapshot與Tetrp authority保持。
- 完整重算summary與配對統計一致；控制組原始artifact SHA及其原400局audit通過；candidate/control身分與gate manifest核對一致。
- 本次驗收為artifact、identity、summary/counters及gate核驗，未重新模擬全部壓縮trace。

## Gate 與唯一改動

僅wasted_t -1.5→0；H1=1、H9=-0.5及其餘完整配置保持。沿用前次編譯artifact，native SHA256 `84bb7c8014b103b46007c50ba325b157babb6b106678859ab581fe34454f9b45`。

前次12個snapshot不足以觀察top-1改變；事前固定擴充55個T可用公開snapshot後，共67個：accepted/rebuilt完整report 67/67一致、candidate authority placements 67/67通過、16個policy Holds與空／非空Hold檢查通過。65/67評分改變、7/67 top-1改變。因此有實際policy activation，不能將不顯著歸因為候選完全沒生效。

## 下一步

依固定順序進入B2B／Surge未兌現價值（含has_back_to_back）：先核對現有leaf、charge/bank與已實現attack的重疊，固定一個隔離假設後再建候選。本次沒有派送下一批、沒有建立自動實驗隊列、沒有修改production。
