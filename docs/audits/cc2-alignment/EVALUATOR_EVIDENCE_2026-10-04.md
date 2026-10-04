# 本輪 evaluator 證據總表與停止點

2026-10-04 井深正式授權啟動：[井深0／0.6最後兩批計畫](WELL_DEPTH_PLAN.md)。先well-off，再queue well-double，各自gate成功後200新KO、重用accepted控制；其他參數保持原accepted。18本機checks／整合source核對通過，Rust及public gate待Actions。完成即停止本輪盤點，不接第6–12項，不自動promotion或確認批；run另記dispatch。下方「離線／未啟動」為先前狀態。

2026-10-04。本表整理已提交的驗收紀錄，B2B兩批已完成驗收並更新於本表；沒有新增測試任務。最新決定優先於舊排序：**驗收B2B clear 0／2，再測井深0／0.6，至此停止這輪參數盤點**。combo及後續清單暫停，不自動排隊。之後轉入選定強化方向與新seed確認；不是把各次最高分參數拼在一起。

accepted仍是frozen aligned CC2 `review_h9_h12`，沒有因以下探索結果變更production。Legacy是Tetrp vendored Kiwi snapshot-v3.2，非stock CC2。

## A．候選直接對accepted（200 KO）

下列CI是候選對accepted的**勝率**，不是勝率差；不能與B表的差值直接混排。

| 候選 | KO勝–負 | 候選勝率／近似95% CI | 證據與判斷 |
|---|---|---|---|
| [visible-T資源候選](VISIBLE_T_200_RESULT_36892959080.md) | 97–103 | 48.5%；41.53～55.47% | 未證明改善；不能外推成完整T-slot消融結果。 |
| [H9 cavity excavation −0.5→0](H9_OFF_200_RESULT_36996780368.md) | 80–120 | 40%；33.39～46.61% | 支持在此環境保留H9=−0.5；不是最佳係數或不可替代性證明。 |

## B．各自對同一Legacy，配對比較（每版200 KO）

accepted控制104–96（52%），100共同seed blocks×兩座位。H1批同時產生控制，其後各批重用相同控制；它不是每次新獨立證據。以下CI是candidate-minus-accepted的**百分點差**，不是對Legacy的勝率CI。

| 候選 | KO勝–負 | 差／配對近似95% CI（pp） | 現階段判斷 |
|---|---|---|---|
| [H1 pending safety 1→0](H1_COMMON_RESULT_37026070707.md) | 107–93 | +1.5；−7.79～+10.79 | 效益未定，保持1。 |
| [wasted_t −1.5→0](WASTED_T_RESULT_37098444257.md) | 99–101 | −2.5；−13.09～+8.09 | 效益未定，保持−1.5。 |
| [B2B Boolean .5→0，bank=0](B2B_LEAF_RESULT_37114400655.md) | 100–100 | −2；−11.86～+7.86 | 效益未定，不能當整個Surge價值已充分表達。 |
| [Boolean=.5，Surge bank=.5](SURGE_RESIDUAL_RESULT_37124649645.md) | 101–99 | −1.5；−10.90～+7.90 | 固定gross residual假設未證明改善。 |
| [Boolean=0，Surge bank=.5](SURGE_INTERACTION_RESULT_2026-10-04.md) | 108–92 | +2；−8.16～+12.16 | 正向點估計，仍不確定。 |
| [Boolean=1，Surge bank=1](SURGE_INTERACTION_RESULT_2026-10-04.md) | 108–92 | +2；−7.02～+11.02 | 聯合數值探索，不能分別歸因兩參數。 |
| [normal／mini／full三表聯合off](CLEAR_SHAPING_RESULT_37173465050.md) | 112–88 | +4；−5.94～+13.94 | 正向點估計，尚未確認；不能分別歸因三張表。 |

第4項補充：

| 候選 | KO勝–負 | 差／配對近似95% CI（pp） | 現階段判斷 |
|---|---|---|---|
| [B2B clear 1→0](B2B_CLEAR_RESULT_2026-10-04.md) | 100–100 | −2；−12.16～+8.16 | 未證明改善，維持1。 |
| [B2B clear 1→2](B2B_CLEAR_RESULT_2026-10-04.md) | 95–105 | −4.5；−14.18～+5.18 | 未證明改善或傷害；不是1最佳的證明。 |

以上正式結果的既有correctness驗收皆通過：固定同局piece seed／換邊／24frames／200k nodes／snapshot-only／Tetrp placement authority，KO-only，zero failure/fallback/parity mismatch。它們不是24frames內真實鍵盤transport的證明。總表重用既有驗收，不聲稱本次重播所有raw traces。

原2×2 Boolean×bank interaction為+5.5pp、CI−6.78～+17.78pp，尚未證實有或沒有交互作用。點估計最高的clear-off也不能直接當champion：多次探索、同一批seeds與寬CI會產生選擇偏差。

## C．機制、重疊與仍不能回答的問題

| 機制 | 控制內容／潛在重疊 | 目前不能宣稱 |
|---|---|---|
| H1 | 公開incoming下真實board壓力，cancel會降低剩餘壓力；共享高度／覆蓋概念 | off未顯著不代表cancel價值缺失，也不代表H1無用。 |
| H9 | 真實board封閉空間的挖掘下界成本；與holes／coverage相關但非等價 | 已支持保留不等於−0.5最佳。 |
| wasted_t | 對某些T使用的額外reward懲罰；與spin表／T資產相互影響 | 本次不確定不能當作永久必需。 |
| B2B Boolean | post-state固定+.5 | 不是bank數量或可兌現時間。 |
| Surge residual | 已充能gross bank×公開next-lock倍率取整再加權；可能與保留B2B偏好互動 | 不保證可達釋放、不等於實際sent、不證明是整體輸局原因。 |
| clear三表 | 在實際sent之外的固定clear類別edge分；PC override可遮蔽 | 家族結果不是單獨mini/TSD的因果結論。 |
| B2B clear | 此次normal_bonus交易旗標的edge加分；另有Boolean leaf與實際攻擊 | 0／2已驗收，均未證明改善；保持1，不代表最佳。 |
| 井深 | cutout後最低欄起、其他9欄皆滿的連續列×0.3；與T-slot／height／transitions互動 | 未看I的proxy不等於一定有害，也不是合法I兌現證書。 |

[charged-state診斷](SURGE_RESULT_37121512490.md)證明樣本中搜尋有release及charged frontier，而bank沒有獨立數量leaf；那是機制線索，不是KO改善證據。H1短局activation及各種gate亦不列入strength樣本；早期transport錯誤FT7與未完成／失敗gate不算。

## D．剩餘範圍與下一階段

| 項目 | 固定比較 | 最新已確認狀態 |
|---|---|---|
| 第4 B2B clear | 原1；候選0／2 | run37187886430／37187910625已驗收，100–100／95–105；correctness通過，維持1。 |
| 第5井深 | 原0.3；候選0／0.6 | 兩版離線prepare與測試已備好，未dispatch。Rust及real snapshot gate未完成。 |
| combo、PC、row transitions、coverage、holes、height、T-slot後續消融 | 舊表第6–12項 | **本輪暫停，不自動啟動。** |

井深兩候選都只改一個係數、獨立從原accepted建立，不疊加前面「最高分」的配置。之後正式啟動仍要通過編譯／配置identity／full report／top1與Hold parity／activation gate；本次只準備，不開Actions。

測完井深後，用完整證據選**一個**有機制理由的強化候選，再預先固定新的seed集合、樣本數與採用條件做獨立確認。不得將舊seeds挑出的最高分又當確認；不因CI跨零就追加到贏，也不因列過清單就繼續耗算力。現在沒有決定confirmation候選或額外樣本數，需等剩餘驗收，不能預支結論。
