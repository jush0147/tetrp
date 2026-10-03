# B2B／Surge 未兌現價值：第一個隔離假設

固定排序第2項；本次 source／authority 審查及 candidate gate，不是直接採用新權重。Production、arena規則、search budget均不變。重現 `node scripts/kiwi-b2b-inventory-audit.js`，證據見 [B2B_INVENTORY_EVIDENCE.json](B2B_INVENTORY_EVIDENCE.json)。

## 實際價值分解

1. **搜尋內兌現**：`GameState::advance` 更新B2B/Surge與forecast transaction；`useful_attack_reward=1`計入forecast.sent增量。因此不能說既有bot完全看不到Surge。清除pending也會改後續盤面/H1，但cancellation直接reward目前為0。
2. **搜尋邊界仍持有**：accepted只有`has_back_to_back=0.5` Boolean leaf；raw B2B=1或8都是同額。它不是每多持有一手累積+0.5的edge reward；`Eval + Reward`的leaf/edge角色分離。不過搜尋中間節點排序也會受leaf值影響，所以後續policy變化包含搜尋分配效應，不能都歸因最終leaf。
3. **普通B2B延續能力**：持有B2B可以改變下一次合格消行的transaction；其價值依可達消行、可見pieces、Hold、盤面與時機而變。Boolean是這種延續能力的proxy，不是Surge兌現行數。
4. **Surge兌現選擇**：非合格的普通消行可以釋放充能，且先處理Surge再normal attack；不消行保留，mini等合格消行繼續累積。持有價值不是永遠不break，更不是將全部bank當成已送出攻擊。

`back_to_back_clear=1`是另一個當次消行edge shaping，依使用者排序留在第4項，這次不改。

## Authority 直接證據與邊界

目前預設TL rules為charge_at=4、base=0；不可沿用較早base3 fixture的假設。使用`resolveAttack`、opener外、無AC／垃圾bonus的普通single：

| 初始公開狀態 | Surge generated | Surge sent | 消行後raw B2B |
|---|---:|---:|---:|
| raw4、multiplier1 | 0 | 0 | 0 |
| raw5、multiplier1 | 1 | 1 | 0 |
| raw8、multiplier1 | 4 | 4 | 0 |
| raw8、pending4 | 4 | 0 | 0 |
| raw8、multiplier1.5 | 6 | 6 | 0 |
| raw8、不消行 | 0 | 0 | 8 |
| raw8、mini single | 0 | 0 | 9 |

另核charging=false與custom base3。這些是實際authority交易witness，不是假裝每個交易都已提供可達geometry。

CC2 `b2b_count`為raw counter−1，另有active bool；`h3_inventory`使用count capped at charge_at作progress，bank呼叫`surge_size_with_rules`轉回raw。**這兩個現有H3欄位權重均0，尚未檢驗有效性。** Bank本身未乘當下multiplier，未經pending cancellation，也未證明兌現消行可達。Progress是計数proxy，並非規則承諾的線性收益。不能直接啟用後稱為精確TL資產價值。

已實現reward與未兌現leaf在同一條完整trajectory可以互補：release後bank消失，不必然重複計分。但現在還有Boolean、B2B clear、clear tables等shaping；新增bank可能使囤積優於取消incoming或及早輸出。這是待驗策略假設，不能由規則公式單獨決定權重。

## 本次唯一候選：B2B Boolean leaf off

`review_h9_h12.has_back_to_back: 0.5 → 0`。其餘完整配置必須相同，包含wasted_t=-1.5、H1=1、H9=-0.5、兩個H3仍0、back_to_back_clear仍1。

問題是：**在現有精確transaction、search與其他shaping之外，額外獎勵「邊界仍有B2B」是否提供KO增量收益？**

先做這個off，是將既有proxy的效益與「缺少Surge residual」分開，不是宣稱off較強，也不是把Surge項排掉。結果不論好壞，都不能證明新的bank模型不需要／一定需要。此步後仍留在第2項審查是否值得提出bank-only假設，不能直接標整項B2B／Surge已測完。

## 有界 gate

- 凍結accepted來源commit `2e243242b674d57491f99b445f75e35fc48a0e26` 加landing artifact run36387270053；重建control與單一候選，control需與frozen native完整report一致。
- Rust完整evaluate同state測試：active/nonactive、count0/1/3/4/8/20、charging on/off、PC on/off、terminal on/off。Reward必須相同；只有存活且active的leaf差−0.5；terminal不改。Synthetic states不是reachability證據。
- 沿用已固定67份public snapshots，沒有依這次分數／勝敗選樣。raw B2B分布0:23、1:13、2:18、3:7、4:6。**沒有charged root，因此此gate不能認證新Surge bank feature的activation。** 這次只檢验Boolean，不增加新的bank feature。
- 同200k nodes、NEXT5、unknown finite tail；固定snapshot的full report、top1改變、Hold重分析及authority lock檢查。無score/top1 activation就停止，不無限找樣本。
- 只有一個40分鐘上限的Actions gate job，成功／失敗均ntfy `just_a_kiwi_for_tetrp`；不盯跑、不自動接200局。Artifact保存30天。

## 後續強度比較邊界

Gate通過仍不代表更強。若進KO比較，沿用共同Legacy、同seed/seat的凍結200控制局，只新跑200候選局；無一般gameplay cap，保持24frames與零fallback契約。正式派送前記錄candidate identity與固定計畫，不以gate action外觀選權重，也不把舊控制當全新独立確認。尚未建立其他參數queue。
