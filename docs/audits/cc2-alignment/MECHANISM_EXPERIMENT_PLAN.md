# 從語意盤點轉入最小機制比較

2026-10-03 最新驗收：[Surge residual 200 KO結果](SURGE_RESIDUAL_RESULT_37124649645.md)101–99，重用accepted控制104–96；差−1.5pp，配對95% CI −10.90～+7.90pp。175918 placements／66389 Holds，零technical failure／fallback／rejection／parity mismatch，無重打。Gate有charged top1 activation。未證明改善，保持bank leaf=0與Boolean +0.5，不追加／掃權重。第2項初輪完成（效益未定，不代表Surge問題已解決）；下一步依固定順序第3項clear三表shaping家族，先語意與隔離檢查，從原accepted出發。未派新arena。以下待跑描述為歷史。

2026-10-03 接續第2項：[charged-bank residual gate→200KO](SURGE_RESIDUAL_PLAN.md)，固定0.5折價gross bank、公開next-lock multiplier，pending不扣因可cancel；不是精確sent。只改一個leaf假設，Boolean/H1/H9/wasted-T保持。20public gate含8charged，通過自動200新KO，失敗停止；沒有其他queue。

2026-10-03 最新：[charged Surge診斷通過](SURGE_RESULT_37121512490.md)，8/8observer parity、每state都看到release與charged known-frontier。Residual bank數量無独立leaf估值是可測假設，尚非勝率缺陷證明；不能說看不到取消價值。下一步限定charged-bank residual、先固定單位與公開pending/multiplier語意，不直接啟用既有H3或改多項。尚未派arena。

2026-10-03 第2項續：[Surge charged-state診斷](SURGE_DIAGNOSTIC_PLAN.md)，固定8public snapshots、captured root transaction審查完成，接accepted只讀search observer及full-report parity。尚無新bank候選，不開arena，不能用sampled selection witness冒充backed-up最佳line。

2026-10-03 最新：[B2B leaf-off200KO完成](B2B_LEAF_RESULT_37114400655.md)，100–100對照accepted104–96，差−2pp／配對CI −11.86～+7.86pp。Correctness全通過，效益未定，保持+0.5。尚未測完整Surge residual，下一步仍第2項charged snapshots取證，不跳clear家族、不直接啟用H3；未派新批。

2026-10-03 最新：[B2B leaf gate成功後正式200新KO計畫](B2B_LEAF_COMMON_PLAN.md)。run37105409459 gate67/67 placements、19 Holds、3/67 top1改變；沿用此binary、不重編。使用者已指示繼續，候選只關Boolean leaf；重用accepted同seed/seat控制，無其他候選queue。正式run另記dispatch，B2B／Surge整項尚未結案。

2026-10-03 第2項開始：[B2B／Surge review與Boolean-off gate](B2B_INVENTORY_REVIEW.md)。source／authority審查完成，僅has_back_to_back 0.5→0做第一個隔離檢驗；H3仍0、B2B當次clear留第4項。67snapshot gate尚待Actions，不自動接200局，ntfy。不將Boolean結果外推成整個Surge residual已測完。

2026-10-03 最新：[wasted-T 200 KO完成](WASTED_T_RESULT_37098444257.md)。candidate off對Legacy99–101，重用accepted控制104–96；差−2.5pp、配對近似95% CI −13.09～+8.09pp。Gate實際7/67 top1改變；arena零technical failure／fallback／rejection／parity mismatch。效益未定，保持wasted_t=-1.5，不追加樣本。下一項B2B／Surge未兌現價值，先語意與隔離假設；沒有派送或自動queue。以下較早狀態為歷史。

2026-10-03 最新：[wasted-T gate停在activation](WASTED_T_GATE_37096877026.md)。run37096877026的Rust／配置／12份baseline report／12placement及Hold檢查通過；10/12評分改變、0/12 top1改變，未開arena。使用者指示繼續：固定新增55個T可用公開局面，一次限定延伸，共67；沿用已編譯artifact、雜湊鎖定，不移除top1 gate、不改權重。成功才接原授權200新局，否則停；不開其他候選。

2026-10-03 已授權開始：[wasted_t off，重用控制組](WASTED_T_OFF_PLAN.md)。只改−1.5→0；重用run37026070707全部accepted 200局，candidate新跑同seed／seat 200局。先Rust配置／same-state／frozen report／真實activation／authority gate，成功才arena。H1=1、H9=-0.5；原順序其他項未派送。不再丟600局，例外simultaneous KO才整組含control换seed重打。ntfy一次；run ID另記。

2026-10-03 排序更新：[後續固定順序](EVALUATOR_NEXT_ORDER_2026-10-03.md)已依使用者要求記錄，優先於下方舊「其他項目尚無排序」。wasted_t → B2B／Surge未兌現價值（含B2B leaf） → clear三表家族 → B2B當次clear reward → Tetris井深 → combo shaping → PC override/bonus分開 → row transitions → base coveredness → base holes → base height隔離 → T-slot bonus/cutout分開。B2B／Surge已提升主線第2；依使用者指定，B2B當次消行第4、井深第5。先單項／家族機制，再有證據的interaction、缺項、最後權重。第1–6項後檢視成本與證據；不自動啟動全清單。本次僅寫計畫、未改bot或派送對戰。

2026-10-03 最新：[H1 共同對手400局結果](H1_COMMON_RESULT_37026070707.md)已完整驗收。100 blocks、400 KO、零technical failure／fallback／parity mismatch，無重打。H1-on對Legacy104–96；off107–93，off-minus-on +1.5pp、配對近似95% CI −7.79～+10.79pp，未證明改善或等價。保持H1=1／H9=-0.5，不採用off、不追加樣本。既定visible-T→H9-off→H1-off初輪完成；其他參數尚無排定次序，下一步先選定單一mechanism hypothesis，不自動派新批次。實際3h20m13s。

2026-10-02 接續已授權：[H1 共同對手固定 KO 比較](H1_COMMON_PLAN.md)，100 seed blocks × on/off × 兩座位，共400局（每版對Legacy 200局）。只改H1，沿用已驗證artifact與同局同seed／24frames；無一般frame cap，simultaneous KO整組重打，technical failure整批不下強度結論。16 runners／每runner兩局；取消shadow search，ntfy完成／失敗一次通知。不自動promotion，run ID另記。30項targeted tests已通過。

2026-10-02 最新：[H1 短診斷結果](H1_SHORT_RESULT_37023218685.md)已核對，4局均到100手無KO、不計分；800 placement／251 Hold parity零差異、零fallback／technical failure。Legacy打破鏡像並產生pending；同一frame672 witness證明H1實際改變I四消／J三消順序（兩份重複觀察，非兩個獨立state）。兩手後盤面相同但attack state不同。僅證明activation，沒有強度結論。下一步擬定on/off各對同一Legacy的固定seed／seat配對KO比較；未派送新run，不自動200場，保持accepted設定。

接續已授權：[H1 vs Legacy 短診斷](H1_SHORT_PLAN.md)，4局、每局最多100手，不是強度批次。H1-on/off各自對vendored Legacy交換座位；同局同seed／24frames，逐snapshot反事實評分與落子比較，離線核對實際H1 node貢獻。非KO不計分，不自動開200場。Run ID另記。

2026-10-02 H1 異常診斷：[run37004950142已中止](H1_MIRROR_DIAGNOSIS_37004950142.md)。抽查兩局4391/4399手仍鏡像，pending=0，H1根本未生效；不是可判強弱的結果。不得重跑同一空盤H1-on/off鏡像對照。下一步先補進度telemetry，驗證使用共同但打法不同的固定對手可觸發H1，再另訂固定配對樣本；未派送新run。不改同局同seed／24frames，也不更換勝負標準。

2026-10-02 接續：使用者指示繼續，開始 [H1-off gate → 固定200場](H1_OFF_200_PLAN.md)。候選只改 pending_safety=1→0，H9=-0.5 及其他項保持 accepted 原設定。前置 gate 成功才自動對戰，完成／失敗 ntfy；不啟動更多候選或調權重。確認 run ID 後另存 dispatch。

2026-10-02 最新結果：[H9-off 固定 200 場](H9_OFF_200_RESULT_36996780368.md)前置 gate 及全批 correctness 通過；關閉版 80–120，配對近似 95% CI 33.39–46.61%，支持保留 H9=-0.5，但不代表最佳權重。H9-off 不採用、不追加樣本；下一項獨立 H1-off 從 accepted baseline 建立，保持 H9=-0.5。H1 尚未建立或派送。

2026-10-02 接續授權：使用者已確認 H9-off（既有 −0.5 關為 0）意義及 correctness gate，指示開始。[H9-off 計畫](H9_OFF_200_PLAN.md)以單一 workflow 串候選 gate → 固定 200 KO；只有 gate 成功才派 shard。從 accepted 獨立建立，沒有 visible-T、H1 或其他權重變更。沿用既有 16 runners／2 matches 配置與 ntfy；不需使用者再接下一步。Run ID 確認後另存。

2026-10-02 結果更新（覆蓋以下歷史進度）：[固定 200 場結果](VISIBLE_T_200_RESULT_36892959080.md)已完成。visible-T 97–103、配對近似 95% CI 41.53–55.47%，correctness 全通過；未證明改善，也不是證明等價或無用。不 promotion、不追加到贏。下一項為從 accepted baseline 獨立建立 H9-off，再 H1-off；本次未派送下一批。200 場實際 1h46m16s，沿用已驗證 runtime，不再插入效能 pilot。

2026-10-02 最新：two-match 完整 arena gate run 36887925067 通過，兩場在單 runner 共 20:09，trace 完全等同 frozen reference。執行組合固定 native + parallelDecisions + 2 match workers/runner；下一步準備 visible-T 正式固定 200 場配置與配對判讀，不再新增效能 pilot。200 場未派送；參數順序不變。

2026-10-01 最新 throughput 結果：run 36863657491 等量 public-snapshot workload 的 2 workers/runner 比 1 worker 省 23.64% wall time，完整 parity 通過；可用於下一步固定 visible-T batch harness 設計，尚未量完整雙場 arena，也未啟動 200 場。停止 worker 數掃描；visible-T → H9-off → H1-off 順序保持。

2026-10-01 最新：parallel native gate run 36859147183 通過，完整 reports/events 與 serial 及舊 native 一致，整場較同 run 串行省 35.26%。可用 native + parallelDecisions 跑後续 visible-T 固定樣本比較；200 場尚未 dispatch，visible-T → H9-off → H1-off 次序維持。

2026-10-01 接續：200 場仍未啟動。使用者不接受目前成本，現做唯一 bounded native serial/parallel decision gate（PARALLEL_ARENA_EXPERIMENT.md），保留同 virtual frame 與 transaction order。沒有新 evaluator 假設、沒有改參數次序。

2026-10-01 最新 gate：native 完整 arena run 36851791560 通過，整場耗時減少 17.68%，全部 reports/events 一致。接下來可用凍結 native profiles 落實 visible-T 的 200 場固定樣本批次；未 dispatch。舊 pilot seed 的 runtime 重打不納入強度樣本。visible-T → H9-off → H1-off 順序不變。

2026-10-01 最新效率 gate：native vs WASM 的 170 次完整比較通過，兩個 profile 完整 request 均約省 16.5%。下一步先接離線 arena 並驗證連續 authority/Hold parity；尚未完成整場驗證，200 場仍未啟動。本表的參數先後不變。

2026-10-01 最新：使用者要求不要因 cache 失敗就結束效率工作，已授權 native release vs WASM 等價性／效能實驗（NATIVE_RUNTIME_EXPERIMENT.md）。下段的「已結案」不再是現況。參數順序仍保留；200 場暫不啟動。

2026-10-01：效率插入工作已結案。Root 枚舉優化保留；request-local movegen cache 在 run 36844153120 完整 parity 通過但變慢，依預定門檻淘汰。回到本文件的 visible-T 主線，下一步落實較大固定樣本的批次配置與成本；尚未啟動 200 場提案或 48 場草案，不跳 H9、不改權重。

## 2026-09-30 接續索引：參數主線保持不變

使用者明確要求保留的是「各個參數的處理順序」。arena 效率是另外的插入工作，記在 [ARENA_EFFICIENCY_HANDOFF.md](ARENA_EFFICIENCY_HANDOFF.md)，不能取代本表或造成參數重排。

- 總順序：語意／環境對齊 → 機制有效性 → 權重調整。
- 已完成深入語意檢查的先後：T-slot → H1 pending safety → H9 cavity；三項的結果文件均已存在，不重做。
- 已排定的機制比較先後：visible-T → H9-off → H1-off。語意審查順序與對戰順序不同，勿混淆。
- 目前停在 visible-T：WASM/browser gate 與八場 correctness pilot 已完成，3–5 不足以淘汰機制。尚無足夠強度結論；不跳到 H9。
- H9-off 與 H1-off 都要各自從 accepted baseline 建獨立候選，不疊 visible-T 或前一個未證實改動。
- 其他參數已在 EVALUATOR_SEMANTICS_2026-09-28.md 全欄盤點，但尚未排定逐項 ablation 的完整次序。不得把清單順序當成已決定的實驗順序，也不得聲稱所有參數都已測完。
- 本次曾討論同批測多個獨立候選，並未形成新的已執行計畫；不據此覆蓋原有順序。
- 48 場草案未啟動；後續提出 100 seed blocks × seat swap = 200 場，同樣未啟動。效率調查完成後回到 visible-T 的固定樣本比較，先更新具體配置與成本，不照舊 48 場 JSON 誤發任務。

此表整理目前已取得的證據；不是已啟動的 arena，也不是自動調參授權。所有比較以固定 accepted baseline 為控制組，不能默默疊上前一個未證實改動。

| 順序 | 唯一改動 | 要回答的問題 | 現況與必要前置 |
|---|---|---|---|
| 1 | T-slot 額度換成 remaining known T + reserve T | 不預支未知 T 的完整 policy 是否更強？ | 已完成固定200局97–103，未證明改善；不採用、不追加 |
| 2 | accepted profile 僅 H9 weight=0 | 洞穴連通性懲罰是否提供其他現有 features／search 之外的 KO 收益？ | 已完成獨立off對accepted 200局80–120；支持保留H9=-0.5，未證明最佳權重 |
| 3 | accepted profile 僅 H1 weight=0 | incoming 條件化盤面懲罰是否改善 KO 勝率？ | 直接on/off鏡像無效，改共同Legacy對手；各200局，off-minus-on +1.5pp、CI跨零；保持H1=1，未證明有用或無用 |

順序反映候選準備程度與已有證據，不代表已知道 feature 重要性排名。每次只前進一項；單項優劣與多項交互作用是不同問題，單項勝出也不自動累積成新 champion。

## 不再拖延的界線

語意盤點不能回答勝率，不能無限要求更多離線 witness。第一項 WASM／browser gate 已通過（run 36702845823），八局 correctness pilot 亦已完成（run 36707273929），不要重新執行已通過的前置工作。不得因本文件存在就一次排三組大量對戰。原使用者要求完成後 ntfy、不要持續盯跑，保持不變。

任何 arena 均沿用既有 snapshot-only、Tetrp referee、top-1 parity／zero fallback、24 frames cadence、shared piece seed／seat swap 與 technical failure 不計分的契約。檢驗強度只用 KO 結果；APP、H1/H9 項目值、風格只作 diagnostic。先鎖定相同 seeds／match protocol 與計算 budget；不能看完勝負再挑有利 seeds 或任意續跑到贏。

小型 pilot 只足以篩查技術問題和大幅退步，不能因贏一場 FT7 宣稱進步。後續比較總量需在實際 browser／arena 成本明確後固定；目前不虛構 power 或需要幾局的精度。通過測試的變體也保留獨立版本與證據，不直接取代 production。

## 本輪以外的項目

既有 inventory 的 clear shaping、wasted T、B2B Boolean、PC override、well、transitions、height 等仍保留。它們不是「已證明重要」；本輪沒有足夠 outcome evidence 判定無用，也不新增 TSD／mini／Hold bonus。不同 shared coefficient 的作用域已記錄，之後調參前須重看；不把本輪變成全參數 sweep。

## 2026-10-02 overnight fixed sample

User authorized the prepared visible-T fixed 200 single-KO games (100 new
seed pairs), using the verified native parallel two-match runtime. See
[bounded execution plan](VISIBLE_T_200_PLAN.md). Do not dispatch the old 48-game
draft, repeat performance pilots, queue H9/H1, promote automatically, or extend
sample size after seeing the score. H9-off then H1-off remain independent
future candidates; this run changes no evaluator weights.
