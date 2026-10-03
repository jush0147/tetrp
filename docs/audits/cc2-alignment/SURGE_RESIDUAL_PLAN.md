# Charged Surge residual：單一候選與固定200KO

使用者在診斷後指示繼續。本次假設是：**只為仍持有的已充能Surge增加折價leaf資產值，是否提升對Legacy的KO勝率？** 不重寫搜尋、不開未充能progress、不變Boolean/B2B-clear等權重。

## 公式與語意

`extra_leaf = 0.5 * floor(bank_base_units * public_next_lock_multiplier)`

- `bank_base_units`共用accepted的`h3_inventory`→`surge_size_with_rules`，包含公開charge_at/base與active bool；未充能、charging關閉或沒有B2B為0。Topout既有early return仍優先，絕不被bank救回。
- multiplier用既有forecast公開clock的`next_attack_multiplier()`：在該post-state下一次預定lock釋放的名目generated量。非真實未来、非任意增加延後時間，也不宣稱下一手存在可達普通clear。
- **不扣pending**：gross bank可用來cancel，也可send；此候選不把兩種用途分別加分，不預支opener額外防禦，不讀opponent future。這是資產proxy，不是已送攻擊或精確生存收益。Pending數量、硬化、時機與盤面仍由現有transition/H1/search處理；此項不宣稱充分反映它們。
- 折價固定0.5，是單次實驗假設，不是經驗校準的兌現機率或KO最佳權重。例：base bank4、multiplier1.5 → generated-equivalent6 → leaf+3。原Boolean+0.5另保持。
- 只改post-state leaf，edge Reward不改；DAG backup使用最後leaf＋途徑reward，不逐步累積同份bank。已釋放則active=false、bank0，避免把同份庫存與已實現sent重複保留。其他既有clear shaping保持，故不能宣称整體完全無偏好重疊。
- 在目前搜尋裡每個被評估node都需leaf估值，包含尚未展開的中間節點；不是只在depth6偷偷改。這也會影響search ordering，是政策候選的一部分。
- 未證明可達兌現、緊急topout前能否來得及釋放。折價只是有界的第一個模型；若失敗不直接掃0.25/0.75或加入更多條件。

工程上僅在`cfg(surge_residual)`設review profile `h3_surge_bank_value=0.5`及將此bank單位乘公開next-lock multiplier後floor；control保留舊code branch且權重0。不直接把旧H3 raw units改名成sent。完整配置除該欄外必须等同accepted。H1=1、H9=-0.5、wasted_t=-1.5、has_back_to_back=0.5、charge weight0保持。Production無改動。

## Gate：一次通過才arena

- 192份JS authority `resolveAttack`交易fixtures：raw B2B 0/1/4/5/8/9 × multiplier1/1.25/1.5/2 × pending0/8 × charging开关 × base0/3。Rust full evaluate核leaf delta、edge Reward完全不變、terminal0。
- Rust實際`GameState.advance` O single驗B2B reset，release後新增leaf必須0。交易fixture不假裝是可達局面集；另有真實snapshot authority gate。
- 固定12份既有perf inputs＋8份真實charged snapshots，共20。frozen accepted vs rebuilt control完整reports必須一致；candidate top1全部authority placement/Hold驗證，空/非空Hold檢查；**至少一份charged input top1改變**，否則停止、不找更多樣本直到過關。
- 保持200k nodes，PublicSnapshot/NEXT5/no history。沿用no-fallback contract；compiled artifact SHA記在本run gate manifest，下游每局／aggregate核對。

## 強度批次（gate通過自動接，不再等一輪回報）

100 seed blocks×兩座位＝200個新candidate對Legacy KO；重用run37026070707原accepted200局（104–96）。同piece seed=2026160001+100×block，holes=seed+1/+2，24 frames/placement，Tetrp authority。控制artifact SHA、原400局重新audit及commit環境相同必須通過。Reuse結果先前已知，屬後續比較非獨立確認。

主結果為100配對seed clusters的candidate-minus-accepted KO勝率與近似95% CI。沒有一般frame cap，360000-frame watchdog／timeout／technical failure／parity mismatch／fallback／rejection整批無強度結論。Simultaneous KO整個block不計，用seed+4×attempt重跑兩版兩座位，最多25 attempts，額外局數另報。

維持16個同時runner、每runner兩局；每job90分鐘／game step80分鐘。Gate40分鐘、aggregate15分鐘，trace3天、summary/build30天。完成或失敗ntfy `just_a_kiwi_for_tetrp`，不持續監看、不自動promotion或追加。沒有其他候選queue。本次是充能asset這一個假設，不是最佳weight搜尋。
