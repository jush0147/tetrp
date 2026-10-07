# 後續 evaluator 機制順序

2026-10-07 [分支續局端到端可行性審查](BRANCH_VALUE_FEASIBILITY_2026-10-07.md)完成，僅文件。發現舊 root A/B KO 工程及未重現方向的複驗已存在，收回再做小批同類續局的建議。這類資料直接支援 root reranking，不能冒充 search leaf labels；尚無合格新模型與成本方案，不派資料／訓練／arena。accepted 不變，目前無待跑任務。下方「唯一主線」及 pending 均為歷史狀態，以本段和最新文件為準。

2026-10-07 [六手樣本核對完成](VALUE_SEGMENT_AUDIT_2026-10-07.md)：8段實際trajectory與root資訊分開保存，揭露／新incoming／endpoint時序導致其非現行search leaf。缺scenario leaf及其合法label對應，沒有新training rows／模型／對戰；不自動延續為leaf-trace工程。

2026-10-06 [勝負value接線設計](WIN_VALUE_SEARCH_CONTRACT_2026-10-06.md)：edge=0、leaf用同一勝負尺度，但F必須含root context與模擬出攻擊／時間資訊；自己盤面value不足以替代現有sent。尚無可用模型與資料契約實作，不開arena、不恢復22項fit或舊權重。設計文件已交付，非新候選。

2026-10-06 [線性模型固定holdout未過](LINEAR_VALUE_HOLDOUT_RESULT_2026-10-06.md)：160既有局訓練／40保留，full logloss .688775，但對常數及三項基準的改善區間皆含0、early較差。依事先門檻停止22項outcome predictor，無新候選／arena／自動調feature或加資料；accepted保持。不要回到舊參數順序或手寫residual支線。

2026-10-06 [離線線性原型完成](LINEAR_VALUE_PILOT_RESULT_2026-10-06.md)：使用者授權新方向，40既有KO／20seed groups，3918 samples。訓練.372秒；留出訊號很弱，early劣於常數。非新arena或production候選，不接舊調參清單、不自動擴大樣本或調feature。value/reward及root→leaf分布問題尚未解決。

2026-10-06 [leaf 合法性重用檢查](RESIDUAL_LEGALITY_REUSE_REVIEW_2026-10-06.md)：父 movegen 不能證明子 leaf；同狀態已展開值已由 transposition/backprop 使用；空中 cache 不含 board-specific 落點。直接重用方案不成立，目前無第二候選。本次只有文件，不派新 run，不自動接 cache／tail／舊參數。

2026-10-06 [剩餘資源防守檢討](RESIDUAL_DEFENSE_REVIEW_2026-10-06.md)：確認P_due近似忽略條件性clear blocking/cancel，但無104–96因果證據。已搜尋收益不可重算，未搜尋模板欠合法可用性證明；尚無第二個低成本候選。本次無新實驗，不自動回舊參數清單。

2026-10-06 [residual KO結果](RESIDUAL_VALUE_KO_RESULT_37452163955.md)：104–96 accepted，CI44.82–59.18%、p=.67781，correctness過、強度未確認改善。保持accepted，不採用此候選、不追加或調參，無新任務；不自動恢復歷史參數清單。

2026-10-06 新授權：[此凍結residual候選一次200 KO](RESIDUAL_VALUE_KO_PLAN_2026-10-06.md)，使用者接受本次約3%成本例外。沒有改weights／候選，非重啟舊參數掃描，cost fail仍成立；不自動追加或promotion。

2026-10-06 [第一個剩餘資源候選驗收](RESIDUAL_VALUE_RESULT_37444591656.md)：有限correctness與activation過，成本總+1.57%、中位+3.04%、p95+1.34%未過。停止此候選，無browser／arena／新weight／加速支線；accepted保持。大方向仍以RESIDUAL_VALUE_DIRECTION為準，目前没有第二候選，不自動恢復本頁舊參數順序。

2026-10-06 設計進度：[第一版具體公式](RESIDUAL_VALUE_DESIGN_2026-10-06.md)。只有低成本剩餘資源估值主線下的局部cutout資產替換；先真實board再對潛在改善折減，不是舊參數掃描。未實作、未派送；成本與機制假設尚待驗證，無自動arena。

**此頁原參數順序現為歷史，不自動續做。2026-10-05目前依據：[低成本剩餘資源估值主線](RESIDUAL_VALUE_DIRECTION_2026-10-05.md)。先做具體替代evaluator設計，不增加搜尋／分析時間，再單一候選，最後KO驗證。tail與效能支線已關閉，newly-sent 1→2撤回；不重啟調參。使用者本次只要求記錄，未派任何新實驗。**

2026-10-05 [shortcut結果](FRONTIER_SHORTCUT_RESULT_37332904019.md)：完整report96次一致、Rust8tests過，但只快0.54%、有一輪較慢，未過5%工程gate；不採用，不開browser／arena。這條性能小實驗結束，沒有新weight依據，原accepted保持，tail仍停止，無新dispatch。

2026-10-05 [有限frontier shortcut](FRONTIER_SHORTCUT_PLAN.md)：使用者授權一個策略等價效能候選；原抽樣後提前跳過必定Failed前的advance，不改weights/budget。12snapshot完整report與三輪latency gate，無arena。原參數順序不因這項工程實驗重排，tail保持停止。

2026-10-05 [work allocation結果](SEARCH_WORK_ALLOCATION_RESULT_37330860246.md)：82.21% attempts為frontier失敗，但800k nodes全部使用、無stall停止；不是node预算损失。最佳链浅不等于root整体没搜深。无新evaluator修改；后续仅提减少无可展开分支遍历的固定预算工程方案，先验证策略语义与wall成本，尚未实施／dispatch。

2026-10-05 目前進行[work allocation離線診斷](SEARCH_WORK_ALLOCATION_PLAN.md)：量現有200k分配／空轉與停止原因，保留final score gate；不改搜尋或weights，無arena。使用者已授權，本機9checks過、Rust待遠端；run另記dispatch。

2026-10-05 [final trace結果](FINAL_SCORE_TRACE_RESULT_37315205579.md)：646paths／4reports一致，精確分解已完成，無已證實回傳bug或新weight依據。近分case有不同深度的末端比較（Hold3/4/5 vs Place6）；若續作先查同預算selection分配，不加算力、不重啟tail／舊參數掃描。現無新run、無production變更。

2026-10-05 目前工作：[final score trace](FINAL_SCORE_TRACE_PLAN.md)，使用者已授權；離線唯讀完成DAG，精確重建top2分數。正式bot沒有新成本，tail仍停止，無新權重或arena。實作已備、Rust gate待Actions；run另記dispatch。

2026-10-05 [4個既有state分數拆解](EXISTING_SCORE_AUDIT_2026-10-05.md)已完成可核對部分，729 samples／accepted report一致。selectedModification=null：沒新證據支持改weights或重跑已關閉假設。完整root最佳鏈分解缺資料，後續提議僅debug-only讀現成top2 backprop鏈（未實作／未dispatch）；不得增加線上搜尋、重啟tail或自動派arena。

2026-10-05 最新決定：使用者拒絕增加分析時間成本。停止 tail-value，取消下方 admission 修補的下一步；不派新 run。accepted 不變。後續限定現有搜尋內低成本替換／重用／減少浪費，以實測 wall-time 不退步為前提，強度仍只看 KO 勝率；相同 node budget 不等於相同成本。尚未選定新的 evaluator 假設，不自動重啟舊參數清單或尾端模擬。

2026-10-05 [bounded-v2 結果](TAIL_VALUE_PREFLIGHT_RESULT_37309709343.md)：publication／quota／40 root commits、14 Holds 通過；shadow 0/20、candidate 2/20 改變首選。wall cost 約26倍不合格。下一步限制失敗 admission 重試，保持 tail 假設／weights／budget，不開arena；完整probe authority/browser gate仍待。未新增run。

2026-10-05 授權繼續修 [tail-value bounded-v2](TAIL_VALUE_PREFLIGHT_PLAN.md)：20% per-allocation probe cap、完整成本預查、siblings reserve、shadow 對照。只一個離線 gate，無 arena，無 accepted 參數變更。此為目前下一步；下方 v1 是歷史狀態，run 另記 dispatch。

2026-10-05 [tail-value preflight已驗收](TAIL_VALUE_PREFLIGHT_RESULT_37291859932.md)：Rust/public root gate成功，20certificate/lock與9Hold，本機另重播20authority commits。probe吃94.07% nodes，12461完成但僅8613隨parent提交；4/20 top1變化中2個published=0，不能歸因新value。此版不開arena；先解決budget/publication與歸因，完整逐probe/browser gate仍未完成。不增加預算／tail深度／不切其他方向；本次沒有新run。

2026-10-05 使用者授權試做：[tail-value離線preflight](TAIL_VALUE_PREFLIGHT_PLAN.md)。隔離Rust候選已準備，7種等權單手backup，所有probe計入200k，parent不完整則整批取消，另記completed/published避免假activation。只一個Actions編譯與20public snapshots job，無arena／無production改動；Rust本機不可用，pending遠端驗證。完整逐probe authority與browser gate尚未完成。run另記dispatch。

2026-10-05 [替代evaluator設計審查](EVALUATOR_REDESIGN_REVIEW_2026-10-05.md)完成，僅文件，未改bot／未開Actions。實作已計算cancel與後續交易，不能說完全沒有動態防禦；已backprop的延續也不能再加分。提出只在known frontier做7種等權未知piece的一層合法transition/value backup，明確承認是stochastic tail估值而非純feature重寫。保留accepted R0/V0作控制與probe終值、probe計入同200k預算；需另處理protocol標記、Hold/spawn與成本gate。尚未實作／驗證強度，沒有自動queue。

2026-10-05 [兩批新seed直接確認已驗收](EVALUATOR_CONFIRMATION_RESULT_2026-10-05.md)：well0.6對accepted96–104（48%，CI40.418–55.582%，p=.6940）；clear-off108–92（54%，CI47.435–60.565%，p=.2912），均未達預註冊改善判準。400正常KO、367070 placements／140479 Holds，zero failure／fallback／rejection／mismatch；唯一terminal Hold已查raw正常KO。維持原accepted，不追加／不promotion／無第三批。使用者已決定不加組合與井深1/1.5，僅原兩批；現均結束。

2026-10-04 新授權：[两候選新seed直接確認](EVALUATOR_CONFIRMATION_PLAN_2026-10-04.md)。先井深0.6，再清行三表off，各200 KO直接對aligned accepted；全是CC2-based，非Native v0。共兩個固定假設、exact p≤.025與paired95% lower>50%，不混搭／不追加／不自動promotion。舊盤點已停止；這是獨立確認。完成ntfy，明晚驗收；run另記dispatch。

2026-10-04 最終驗收：[井深0.6結果與收尾](WELL_DOUBLE_RESULT_37200443114.md)。0.6版112–88，accepted104–96，差+4pp、配對95% CI −5.837～+13.837pp；0版101–99。最後400新KO均zero failure／fallback／rejection／mismatch，兩gate成功。未證明改善，維持0.3。**本輪參數盤點已完成並停止，不接舊清單、不新增run、不promotion。** 替代evaluator仍屬討論，尚未啟動。下方pending/gate進行中敘述為歷史狀態。

2026-10-04 最新驗收：[井深0結果](WELL_OFF_RESULT_37200417596.md)：101–99，accepted104–96，差−1.5pp，配對95% CI −11.614～+8.614pp。200新KO、171974 placements／64856 Holds，zero failure／fallback／rejection／mismatch；維持0.3。井深0.6 run 37200443114 查詢時正在gate，尚未完成；等該批後才結束本輪，不新增任務。

2026-10-04 井深正式授權啟動：[井深0／0.6最後兩批計畫](WELL_DEPTH_PLAN.md)。先well-off，再queue well-double，各自gate成功後200新KO、重用accepted控制；其他參數保持原accepted。18本機checks／整合source核對通過，Rust及public gate待Actions。完成即停止本輪盤點，不接第6–12項，不自動promotion或確認批；run另記dispatch。下方「離線／未啟動」為先前狀態。

2026-10-04 最新驗收：[B2B clear0／2結果](B2B_CLEAR_RESULT_2026-10-04.md)。0版100–100，2版95–105，accepted104–96；差−2pp／−4.5pp，CI均跨零，維持1。400新KO、332022 placements／124479 Holds，zero failure／fallback／rejection／mismatch；唯一terminal Hold原始事件確認正常topout。第4項完成，只剩井深0／0.6（控制.3），之後停止本輪盤點，不接第6–12項。本次未dispatch井深，未改production。

2026-10-04 最新範圍決定（優先於下方舊清單）：[本輪證據總表與停止點](EVALUATOR_EVIDENCE_2026-10-04.md)。先驗收B2B clear0／2，再測井深0／0.6、控制0.3；**測完井深停止本輪盤點，暫停第6–12項**。後續選單一強化方向用新seeds確認，不拼各次最高分。本次0／0.6離線候選及Rust模板已備，JS6checks與真實accepted source安裝核對通過；Rust未跑。未push、未新增Actions／對戰，未查詢B2B即時結果。

2026-10-04 等待第4項期間：[第5項井深離線審查與候選](WELL_DEPTH_REVIEW.md)已準備。0.3×最低欄頂端起、其餘9欄皆滿的連續列數，計於T-slot cutout後；無直接I/Hold兌現条件。只備0.3→0的獨立prepare與Rust邊界測試；JS5 checks／真實source安裝通過，Rust待跑。依使用者限制未push、未新增Actions或對戰；第4項兩批保持原計畫。

2026-10-04 第4項授權開始：[B2B當次clear 1→0／2](B2B_CLEAR_PLAN.md)。先btb-clear-off，再queue btb-clear-double，各自gate成功後200新KO、重用accepted控制。只改back_to_back_clear，保留三表原值／Boolean=.5／bank=0，非Surge候選。ntfy，無第5項queue，不自動promotion或擴權重。run另記dispatch。

2026-10-04 最新驗收：[第3項clear三表off结果](CLEAR_SHAPING_RESULT_37173465050.md)。200新KO為112–88，重用accepted104–96，差+4pp、配對95% CI−5.94～+13.94pp。Correctness全部通過，195062 placements／76137 Holds，零failure／fallback／rejection／mismatch／重打；gate3/20 top1 activation。效益未定，保持accepted，不promotion或追加到顯著。第3項初輪完成，下一項第4 back_to_back_clear 1→0語意與隔離審查；第5仍Tetris井深。本次未派新arena。

2026-10-04 第3項開始：[clear三表聯合消融](CLEAR_SHAPING_PLAN.md)。使用者繼續授權；normal／mini／full表全零，其餘accepted保持。已核對PC override、fallback、精確sent並存語意。Evaluator函式不改、不帶Surge候選；720 Rust數值組合＋20public gate通過才200新KO，重用控制，ntfy；只此候選，無第4项queue。run另記dispatch。

2026-10-04 最新驗收：[Boolean×Surge兩批與交互作用結果](SURGE_INTERACTION_RESULT_2026-10-04.md)。run37133089622 (0,0.5)與37133115397 (1,1)均108–92；accepted104–96，差皆+2pp但各CI跨零。原2×2 interaction +5.5pp、CI−6.78～+17.78pp，未證實。兩批correctness全部通過，合計400新KO、336264 placements／127427 Holds，零failure／fallback／rejection／mismatch／重打。保持accepted，不promotion、不追加樣本／掃權重。第2項已授權補測完成，下一步恢復既定第3項clear三表家族語意與隔離審查；未派新arena。

2026-10-03 使用者授權補測：[Boolean×Surge交互作用及(1,1)](SURGE_INTERACTION_PLAN.md)。先(0,0.5)200新KO補第四格，再queue(1,1)200新KO；各自gate／固定控制／ntfy。第3項暫停，不擴大weight sweep。run ID另記dispatch。

2026-10-03 最新驗收：[Surge residual 200 KO結果](SURGE_RESIDUAL_RESULT_37124649645.md)101–99，重用accepted控制104–96；差−1.5pp，配對95% CI −10.90～+7.90pp。175918 placements／66389 Holds，零technical failure／fallback／rejection／parity mismatch，無重打。Gate有charged top1 activation。未證明改善，保持bank leaf=0與Boolean +0.5，不追加／掃權重。第2項初輪完成（效益未定，不代表Surge問題已解決）；下一步依固定順序第3項clear三表shaping家族，先語意與隔離檢查，從原accepted出發。未派新arena。以下待跑描述為歷史。

第2項接續：[Surge residual固定候選](SURGE_RESIDUAL_PLAN.md)，折價0.5的已充能gross generated-equivalent leaf、按公開next-lock multiplier。Gate通過自動200新KO，不新增progress或改Boolean。這是待驗假設，尚無強度結果，其餘順序不變。

第2項最新：[Surge診斷結果](SURGE_RESULT_37121512490.md)已驗收；搜尋可release也能到charged frontier，未兌現bank無獨立數量leaf。下一步charged-bank residual單一候選的明確定義；沒有權重變更／arena，並未證明它是輸局原因。其餘排序保持。

最新驗收：[第2項Boolean leaf-off結果](B2B_LEAF_RESULT_37114400655.md)100–100，accepted104–96；配對差−2pp、CI跨零，correctness通過。保持+0.5，無追加。第2項尚未完成：下一步charged public states核對bank與可達release／搜尋邊界，不能將Boolean ablation外推為Surge資產估值已足夠。未派新arena。

最新進度：[B2B Boolean leaf-off正式200新KO](B2B_LEAF_COMMON_PLAN.md)獲使用者繼續授權；gate37105409459已通過且3/67 top1改變。沿用artifact，重用accepted200控制；只有這一候選。下方「未派arena」是前一階段紀錄；完整Surge residual仍未測完，不跳第3項。

目前進度：[第2項審查與單一Boolean-off gate](B2B_INVENTORY_REVIEW.md)。只將has_back_to_back 0.5→0；先驗證真實search activation／authority，未派arena。Surge bank與charge沒有啟用，也沒有把整項未兌現價值標成已完成。

使用者要求先把其他項目排好。此文件是後續工作的固定預設順序，不是一次授權全部 arena，也不是重要性排名。2026-10-03 起優先於舊文件「其他項目尚無排序」的描述。本次只記錄，未修改 bot 或派送對戰。

## 已完成，不重新排隊

- wasted_t-off：[200新KO結果](WASTED_T_RESULT_37098444257.md)99–101，重用accepted控制104–96；差−2.5pp、配對近似95% CI −13.09～+8.09pp。Correctness通過且有top1 activation，效益未定；保持−1.5，不追加。下一個待處理項為下表第2項B2B／Surge未兌現價值。

- visible-T 資源候選：200局97–103，未證明改善，不採用。這不等於測過整個 T-slot 機制是否有用。
- H9-off：對 accepted 80–120，支持保留目前 H9=-0.5，不代表最佳權重。
- H1-off：各對同一 Legacy 200局，on104–96、off107–93，配對差+1.5pp、CI跨零。保持H1=1，效益未定；不得說已證明無用。

## 固定順序與單項問題

每項先利用已有語意資料，只補尚缺的 source/真實snapshot證據，再建立隔離候選。表內的 off 是機制檢驗，不是先決定刪除。

| 順序 | 機制 | 首個隔離比較／問題 | 為何排在這裡 |
|---|---|---|---|
| 1（已完成初輪） | wasted_t | -1.5→0，其他不變；off99–101，accepted104–96，配對差CI跨零，效益未定，保持−1.5 | 不重新排隊或追加到顯著；不是最佳權重證據 |
| 2 | B2B／Surge 未兌現價值（含 has_back_to_back） | 先審查 Boolean +0.5、零權重 charge/bank 與剩餘可見方塊的兌現關係；確認 horizon 外資產估值及已計入攻擊的重疊，再固定一個隔離假設。不得同時開啟多項 bonus | S2 核心機制：規則 transaction 已實作，不代表 leaf 已充分評價尚未兌現的資產；優先於傳統幾何項 |
| 3 | clear 類型 shaping | 只將 normal_clears、mini_spin_clears、spin_clears 三張表的額外 reward 一起關閉，保留精確 sent、B2B/combo/PC。問整個固定消行偏好是否有增量效益 | 直接影響攻守選擇；可與已有 authority transaction 對照 |
| 4 | back_to_back_clear | 只關閉此次 clear 的 B2B 額外 reward；不改 B2B 規則或 leaf | 將已實現攻擊的偏好與持有資產的價值拆開 |
| 5 | tetris_well_depth | +0.3→0；不改 T-slot cutout | 檢驗沒有可見 I／到達時機條件的井深資產估值 |
| 6 | combo_attack | 只把舊離散 combo 額外 reward 關閉。精確 combo transaction 保持 | 檢驗舊 combo 偏好在精確 sent 之外的作用 |
| 7 | perfect_clear / override | 先只把 perfect_clear_override true→false，保留+15；其後另一個獨立比較只把+15→0、保留原override。不可同時改兩者 | PC 是獎勵與覆蓋控制兩件事；必須先分清其他 shaping 被遮蔽的情況 |
| 8 | row_transitions | -0.5→0；其他 board metrics 保持 | 單一幾何 proxy，適合先檢验其增量效益 |
| 9 | base coveredness | h6_base_coveredness_scale 1→0；不改共享 cell_coveredness 或 cap6，故 H1 不變 | 隔離 base 覆蓋懲罰，避免一個改動同時修改 incoming safety |
| 10 | base holes | h6_base_holes_scale 1→0；H1與H9都保持 | 測 holes 在覆蓋／cavity 等現有項之外的增量價值 |
| 11 | base height family | 先隔離 base 專用開關，再分普通 height、upper-half、upper-quarter 三個獨立比較；共享係數在 H1 的用途保持 | 高度項有耦合，不能直接改共享係數後誤稱單項測試 |
| 12 | T-slot 整體估值 | 先只移除直接 tslot bonus，保留 cutout；再另一個獨立候選關閉整個模板估值與 cutout，評估聯合機制 | cutout 同時改 holes、coverage、height、transitions、well，影響最廣；不能將 bonus=0 說成整個機制移除 |

第3項是**一個機制家族的聯合消融**，不是單一數值參數。結果不能歸因某張表；若需要定位，家族內追加順序為 normal→mini→full，各獨立回到原 accepted，須先記錄新的具體實驗。第2、7、11、12項內子比較也逐個處理，不一次建多候選。結果若不明確，不任意換成一堆权重或追加到贏。

2026-10-03 修訂原因：B2B／Surge 未兌現價值是 S2 核心評價問題，從後置缺項階段提升至第2項，原 has_back_to_back 併入審查；依使用者明確指定，B2B 當次消行獎勵列第4、Tetris井深列第5，其餘順延。每次實驗仍只改一個假設。此順序兼顧使用者優先次序與「假設清晰、對出手的直接影響、隔離成本」；不是聲稱前面更重要、後面更沒用。完成第1–6項後做一次證據整理，判斷第7–12項是否仍值得花同等成本；不因列了表就自動耗完所有場次。若新證據要求改順序，先在本文件記具體理由與變更，再執行；不得因一次追問臨時轉方向。

## 重疊、缺項與權重：另外三個階段

**重疊／interaction**：單項off不差，不足以認定冗餘；單項off變差也不表示該項不可替代。只有兩項有具體 source/行為重疊證據、且確實需要解決時，才做預先固定的2×2比較。優先關係為clear shaping↔sent/cancel、B2B clear↔B2B leaf、base holes↔coveredness/H9。不把聯合消融當單項因果結論。

**缺項假設預設順序**：① cancellation 的額外價值；② 一般資產兌現時間與公開incoming時序；③ 未知tail／Hold的延續穩健性。B2B charge／Surge 未兌現價值已提升主線第2項，不在此處重複排隊。這些是候選研究問題，不是已證實缺陷或可直接啟用的bonus。每項需先證明現有search、clear shaping、board transition尚未充分表達目標差異，避免重複獎勵。H1不顯著不等於證明cancel reward必須加。預設在上述既有機制整理之後才選一項，不同時擴張search與evaluator。

**最後才調權重**：對保留且有證據的機制預先固定少量數值；使用未參與選擇的確認seeds，不以先前400局找出最有利權重後又當驗證。當前 useful_attack_reward=1 保持為既有sent權重／尺度參考，不預設未來永遠最佳，也不混入每次off比較。max_cell_covered_height=6 是計量上限，需獨立假設才改。

softdrop維持0，因本arena不測物理按鍵成本；tetrio_s2與其inactive branch不因名字而啟用。H3 charge/bank目前零值列入主線第2項；cancellation零值保留於後續缺項階段，均不能報成已驗證沒用。神經網路、Native重做、TBP、ARE支援與search budget變更均不在此排序內。

## 每項共用執行契約

- 各候選從凍結accepted獨立建立，不疊上尚未確認的off。將來採用新baseline時必須另記版本與比較邊界。
- 先source隔離/配置diff、實際搜尋activation與authority parity；既有已通過的證據不重跑成漫長pilot。不要求每項開發新observer平台。
- 在決定強度批次前固定對手、seeds、樣本、主判讀量與資源限額。參數是否在該matchup生效要先確認；不重演H1鏡像。
- 不把每項都預先定為400局，也不以少數短局選強弱。現有共同Legacy配對harness可沿用；對其他對手的泛化另需證據。
- 同局同piece seed、交換seat、24frames、snapshot-only、Tetrp authority、top1/Hold/spin/cells/lock/clear parity、零fallback。KO唯一強度criterion。
- 無一般frame cap裁勝；watchdog/技術失敗不計輸贏；完成/失敗ntfy、不持續盯跑。不自動續批或promotion。
- 標記四種結論：有改善證據／有退步證據／不確定／實驗無效。未顯著不等於無用，不以外觀或APP替代KO。
