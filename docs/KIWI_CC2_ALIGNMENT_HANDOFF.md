# Kiwi：回到 CC2 分支做 Tetrp 規則耦合審查

2026-10-04 最新驗收：[井深0結果](audits/cc2-alignment/WELL_OFF_RESULT_37200417596.md)：101–99，accepted104–96，差−1.5pp，配對95% CI −11.614～+8.614pp。200新KO、171974 placements／64856 Holds，zero failure／fallback／rejection／mismatch；維持0.3。井深0.6 run 37200443114 查詢時正在gate，尚未完成；等該批後才結束本輪，不新增任務。

2026-10-04 井深正式授權啟動：[井深0／0.6最後兩批計畫](audits/cc2-alignment/WELL_DEPTH_PLAN.md)。先well-off，再queue well-double，各自gate成功後200新KO、重用accepted控制；其他參數保持原accepted。18本機checks／整合source核對通過，Rust及public gate待Actions。完成即停止本輪盤點，不接第6–12項，不自動promotion或確認批；run另記dispatch。下方「離線／未啟動」為先前狀態。

2026-10-04 最新驗收：[B2B clear0／2結果](audits/cc2-alignment/B2B_CLEAR_RESULT_2026-10-04.md)。0版100–100，2版95–105，accepted104–96；差−2pp／−4.5pp，CI均跨零，維持1。400新KO、332022 placements／124479 Holds，zero failure／fallback／rejection／mismatch；唯一terminal Hold原始事件確認正常topout。第4項完成，只剩井深0／0.6（控制.3），之後停止本輪盤點，不接第6–12項。本次未dispatch井深，未改production。

2026-10-04 最新範圍決定（優先於下方舊清單）：[本輪證據總表與停止點](audits/cc2-alignment/EVALUATOR_EVIDENCE_2026-10-04.md)。先驗收B2B clear0／2，再測井深0／0.6、控制0.3；**測完井深停止本輪盤點，暫停第6–12項**。後續選單一強化方向用新seeds確認，不拼各次最高分。本次0／0.6離線候選及Rust模板已備，JS6checks與真實accepted source安裝核對通過；Rust未跑。未push、未新增Actions／對戰，未查詢B2B即時結果。

2026-10-04 等待第4項期間：[第5項井深離線審查與候選](audits/cc2-alignment/WELL_DEPTH_REVIEW.md)已準備。0.3×最低欄頂端起、其餘9欄皆滿的連續列數，計於T-slot cutout後；無直接I/Hold兌現条件。只備0.3→0的獨立prepare與Rust邊界測試；JS5 checks／真實source安裝通過，Rust待跑。依使用者限制未push、未新增Actions或對戰；第4項兩批保持原計畫。

2026-10-04 第4項授權開始：[B2B當次clear 1→0／2](audits/cc2-alignment/B2B_CLEAR_PLAN.md)。先btb-clear-off，再queue btb-clear-double，各自gate成功後200新KO、重用accepted控制。只改back_to_back_clear，保留三表原值／Boolean=.5／bank=0，非Surge候選。ntfy，無第5項queue，不自動promotion或擴權重。run另記dispatch。

2026-10-04 最新驗收：[第3項clear三表off结果](audits/cc2-alignment/CLEAR_SHAPING_RESULT_37173465050.md)。200新KO為112–88，重用accepted104–96，差+4pp、配對95% CI−5.94～+13.94pp。Correctness全部通過，195062 placements／76137 Holds，零failure／fallback／rejection／mismatch／重打；gate3/20 top1 activation。效益未定，保持accepted，不promotion或追加到顯著。第3項初輪完成，下一項第4 back_to_back_clear 1→0語意與隔離審查；第5仍Tetris井深。本次未派新arena。

2026-10-04 第3項開始：[clear三表聯合消融](audits/cc2-alignment/CLEAR_SHAPING_PLAN.md)。使用者繼續授權；normal／mini／full表全零，其餘accepted保持。已核對PC override、fallback、精確sent並存語意。Evaluator函式不改、不帶Surge候選；720 Rust數值組合＋20public gate通過才200新KO，重用控制，ntfy；只此候選，無第4项queue。run另記dispatch。

2026-10-04 最新驗收：[Boolean×Surge兩批與交互作用結果](audits/cc2-alignment/SURGE_INTERACTION_RESULT_2026-10-04.md)。run37133089622 (0,0.5)與37133115397 (1,1)均108–92；accepted104–96，差皆+2pp但各CI跨零。原2×2 interaction +5.5pp、CI−6.78～+17.78pp，未證實。兩批correctness全部通過，合計400新KO、336264 placements／127427 Holds，零failure／fallback／rejection／mismatch／重打。保持accepted，不promotion、不追加樣本／掃權重。第2項已授權補測完成，下一步恢復既定第3項clear三表家族語意與隔離審查；未派新arena。

2026-10-03 使用者授權補測：[Boolean×Surge交互作用及(1,1)](audits/cc2-alignment/SURGE_INTERACTION_PLAN.md)。先(0,0.5)200新KO補第四格，再queue(1,1)200新KO；各自gate／固定控制／ntfy。第3項暫停，不擴大weight sweep。run ID另記dispatch。

2026-10-03 最新驗收：[Surge residual 200 KO結果](audits/cc2-alignment/SURGE_RESIDUAL_RESULT_37124649645.md)101–99，重用accepted控制104–96；差−1.5pp，配對95% CI −10.90～+7.90pp。175918 placements／66389 Holds，零technical failure／fallback／rejection／parity mismatch，無重打。Gate有charged top1 activation。未證明改善，保持bank leaf=0與Boolean +0.5，不追加／掃權重。第2項初輪完成（效益未定，不代表Surge問題已解決）；下一步依固定順序第3項clear三表shaping家族，先語意與隔離檢查，從原accepted出發。未派新arena。以下待跑描述為歷史。

2026-10-03 修正：[Surge residual run37124362998配置覆寫](audits/cc2-alignment/SURGE_RESIDUAL_FAILURE_37124362998.md)。插入0.5後被原初始化歸0，Rust配置斷言擋下，無arena。已改review方法內唯一bank初始化、補regression/actual-source檢查，12tests過；不改formula/權重/門檻。新SHA重派同gate→200KO，run另記。

2026-10-03 接續：[Surge residual單一候選](audits/cc2-alignment/SURGE_RESIDUAL_PLAN.md)。固定leaf=0.5×floor(charged bank base×public next-lock multiplier)，gross資產不扣pending、不預支opener；未充能/釋放/topout0，非已送量或兌現機率。Boolean+0.5等保持；不開progress。192 authority fixtures→Rust full-eval/release測試，12+8=20public gate，至少1 charged top1改變；成功自動接200新candidate KO／重用accepted200，不再等回報，失敗停止ntfy。單一假設不掃weight，run另記；production不改。

2026-10-03 最新：[Surge診斷37121512490通過](audits/cc2-alignment/SURGE_RESULT_37121512490.md)。8/8完整accepted report parity，283place root本機重驗一致；1583659 evals含17791release／295220 charged known-frontier，每snapshot都有兩類。排除本樣本「不會Surge／到不了frontier」，支持尚未釋放bank缺獨立數量leaf的假設，未證明選錯或KO損失。原版也會sent0釋放取消5。下一步只定義charged-bank residual候選（單位、multiplier/pending、release歸零），不開progress、不改Boolean/clear、不重寫search；尚未啟用權重／派arena。仍第2項。

2026-10-03 接續：[8 charged snapshots診斷](audits/cc2-alignment/SURGE_DIAGNOSTIC_PLAN.md)。固定最新run block0兩candidate seats，各4個charged公共局面；captured roots已authority驗證，發現release可sent0且取消incoming，也有保留／Hold。原trajectory是leaf-off，接續Actions用frozen accepted重新搜尋與只讀observer完整report parity，計release/held-bank及known-frontier，非最優continuation歸因。不加bonus、不開arena；run另記，ntfy後驗收。

2026-10-03 最新：[B2B Boolean leaf-off200KO結果](audits/cc2-alignment/B2B_LEAF_RESULT_37114400655.md)驗收通過。run37114400655 candidate100–100，重用accepted104–96；差−2pp、配對近似95% CI −11.86～+7.86pp。179692placements／67674Holds零差異、零fallback/rejection/technical failure，無重打。維持has_back_to_back=0.5，不追加。耗時1h56m53s。仍在第2項：下一步真實charged snapshots之bank／release/search frontier取證，不能把Boolean結果當完整Surge估值結案；未派新批。

2026-10-03 最新：[B2B leaf gate37105409459成功](audits/cc2-alignment/B2B_LEAF_GATE_DISPATCH.md)，67placements／19Holds、66評分與3top1改變，配置及artifact核驗通過。「No arena launched」是gate-only預定通知，非失敗。使用者繼續，接[固定200新KO](audits/cc2-alignment/B2B_LEAF_COMMON_PLAN.md)：candidate hash9011774f…fa52對同一Legacy，重用原accepted200控制；不重編或重跑search gate，16 runners×兩局、ntfy。僅Boolean+0.5→0，不改H3或第4項B2B clear；無其他queue，run另記。

2026-10-03 接續第2項：[B2B／Surge inventory review](audits/cc2-alignment/B2B_INVENTORY_REVIEW.md)已完成source與10個authority witnesses。第一個隔離候選只關has_back_to_back +0.5→0，不改back_to_back_clear或啟用H3。已確認現有H3 bank未乘multiplier／pending、progress為proxy；不能直接稱精確資產。沿用67public snapshots（root raw0–4，無charged root），本機6 checks通過；一次Actions gate編譯Rust/full report/top1/Hold/placement檢查，ntfy，無自動arena。B2B／Surge整項尚未結案；run另記dispatch。

2026-10-03 最新：[wasted-T 200 KO結果](audits/cc2-alignment/WASTED_T_RESULT_37098444257.md)。run37098444257全部102 jobs成功；67份gate中65評分／7 top1改變。200新candidate局99–101，重用accepted同seed/seat控制200局104–96；差−2.5pp、配對近似95% CI −13.09～+8.09pp。167854 placements／63389 Holds，零technical failure／fallback／rejection／parity mismatch，無重打。效益未定，保持wasted_t=-1.5、H1=1、H9=-0.5，不promotion或追加。wall1h46m04s。下一項固定為B2B／Surge未兌現價值；未派送新批次或建立自動queue。以下gate未通過等描述為歷史。

2026-10-03 最新：[wasted-T gate停在activation](audits/cc2-alignment/WASTED_T_GATE_37096877026.md)。run37096877026的Rust／配置／12份baseline report／12placement及Hold檢查通過；10/12評分改變、0/12 top1改變，未開arena。使用者指示繼續：固定新增55個T可用公開局面，一次限定延伸，共67；沿用已編譯artifact、雜湊鎖定，不移除top1 gate、不改權重。成功才接原授權200新局，否則停；不開其他候選。

2026-10-03 已授權開始：[wasted_t off，重用控制組](audits/cc2-alignment/WASTED_T_OFF_PLAN.md)。只改−1.5→0；重用run37026070707全部accepted 200局，candidate新跑同seed／seat 200局。先Rust配置／same-state／frozen report／真實activation／authority gate，成功才arena。H1=1、H9=-0.5；原順序其他項未派送。不再丟600局，例外simultaneous KO才整組含control换seed重打。ntfy一次；run ID另記。

2026-10-03 排序更新：[後續固定順序](audits/cc2-alignment/EVALUATOR_NEXT_ORDER_2026-10-03.md)已依使用者要求記錄，優先於下方舊「其他項目尚無排序」。wasted_t → B2B／Surge未兌現價值（含B2B leaf） → clear三表家族 → B2B當次clear reward → Tetris井深 → combo shaping → PC override/bonus分開 → row transitions → base coveredness → base holes → base height隔離 → T-slot bonus/cutout分開。B2B／Surge已提升主線第2；依使用者指定，B2B當次消行第4、井深第5。先單項／家族機制，再有證據的interaction、缺項、最後權重。第1–6項後檢視成本與證據；不自動啟動全清單。本次僅寫計畫、未改bot或派送對戰。

2026-10-03 最新：[H1 共同對手400局結果](audits/cc2-alignment/H1_COMMON_RESULT_37026070707.md)已完整驗收。100 blocks、400 KO、零technical failure／fallback／parity mismatch，無重打。H1-on對Legacy104–96；off107–93，off-minus-on +1.5pp、配對近似95% CI −7.79～+10.79pp，未證明改善或等價。保持H1=1／H9=-0.5，不採用off、不追加樣本。既定visible-T→H9-off→H1-off初輪完成；其他參數尚無排定次序，下一步先選定單一mechanism hypothesis，不自動派新批次。實際3h20m13s。

2026-10-02 接續已授權：[H1 共同對手固定 KO 比較](audits/cc2-alignment/H1_COMMON_PLAN.md)，100 seed blocks × on/off × 兩座位，共400局（每版對Legacy 200局）。只改H1，沿用已驗證artifact與同局同seed／24frames；無一般frame cap，simultaneous KO整組重打，technical failure整批不下強度結論。16 runners／每runner兩局；取消shadow search，ntfy完成／失敗一次通知。不自動promotion，run ID另記。30項targeted tests已通過。

2026-10-02 最新：[H1 短診斷結果](audits/cc2-alignment/H1_SHORT_RESULT_37023218685.md)已核對，4局均到100手無KO、不計分；800 placement／251 Hold parity零差異、零fallback／technical failure。Legacy打破鏡像並產生pending；同一frame672 witness證明H1實際改變I四消／J三消順序（兩份重複觀察，非兩個獨立state）。兩手後盤面相同但attack state不同。僅證明activation，沒有強度結論。下一步擬定on/off各對同一Legacy的固定seed／seat配對KO比較；未派送新run，不自動200場，保持accepted設定。

接續授權：[H1 vs Legacy四局短診斷](audits/cc2-alignment/H1_SHORT_PLAN.md)。每局最多100手；H1-on/off各對同一vendored Legacy交換座位，同seed／同cadence，非KO不計分。逐snapshot雙版本比較，最多8份實際搜尋H1 observer取證。沒有自動200場；run ID另存。勿重跑前一個鏡像H1直接對打。

2026-10-02 最新：[H1鏡像對局診斷](audits/cc2-alignment/H1_MIRROR_DIAGNOSIS_37004950142.md)。run37004950142因16shards跑逾2h無完成而取消，已確認停止。抽查兩局約4400手、相同盤面／動作／攻擊、pending始終零；H1未被觸發。無強度結論，不直接重跑200場。不改同seed／同cadence；需先驗證共同且打法不同的對手能觸發H1，補進度證據後才另訂比較。新run未啟動。

2026-10-02 接續授權：[H1-off gate → 200 KO](audits/cc2-alignment/H1_OFF_200_PLAN.md)開始準備／派送。唯一候選變更 pending_safety=1→0，保留 H9=-0.5；共用既有 runner，不改 authority 或 production。Gate 失敗不開對戰，成功自動接固定200場，ntfy一次通知。Run ID 見後續 dispatch 紀錄。

2026-10-02 最新結果：[H9-off 200 場完成](audits/cc2-alignment/H9_OFF_200_RESULT_36996780368.md)，80–120、correctness 全通過，支持保留目前 H9=-0.5。無 production 改動、不續跑到贏；下一项獨立 H1-off，保持 H9 與其他設定不變，尚未派送。含 gate 約 1h18m，沿用現行 batch runtime。

2026-10-02 接續：使用者已授權開始 [H9-off gate → 200 KO](audits/cc2-alignment/H9_OFF_200_PLAN.md)。候選只把 accepted 的 H9 −0.5 改為 0。Actions gate 成功後自動接固定對戰，失敗則停止並 ntfy。不修改 production，不加 visible-T、不進 H1，不再做效能 pilot。Run ID 另存 dispatch 紀錄。

2026-10-02 最新：[visible-T 固定 200 場完成](audits/cc2-alignment/VISIBLE_T_200_RESULT_36892959080.md)，97–103、correctness 全通過，實際 1h46m16s。沒有改善證據，不 promotion、不追加樣本。下一項獨立 H9-off，再 H1-off；未啟動下一批。保留既有 accepted baseline 與已驗證批次 runtime；以下較早狀態均為歷史。

更新：2026-09-26。**上下文切換後先讀本檔，再讀指定原始碼；不要重新要求使用者選方向。**

續篇：已完成第一輪[搜尋規則耦合審查](audits/cc2-alignment/README.md)，含完整資料流、保留／替換範圍、三個已執行 source-expression witnesses，以及下一步真正 Rust differential harness。Production 未改，未開對戰；完整 Rust parity 尚未執行。以下「尚未完成審查」為建立交接時的歷史狀態，接續以續篇為準。

後續已建立[真正 Rust transition 診斷入口](audits/cc2-alignment/TRANSITION_HARNESS.md)：本機65個authority fixtures、9項targeted checks通過，Rust編譯／執行交新增Actions workflow。查最新 `CC2 Tetrp transition diagnostic` run與artifact；不要將Actions success等同模型parity。此輪只查transaction，Hold／movegen／spawn仍未認證。

Run `36246453477` 已完整跑完並核對，見[結果](audits/cc2-alignment/RESULT_36246453477.md)：65例中58一致、7差異（4 timing／2 queue scan／1頂端截斷），沒有driver錯誤。接著先做單獨clock修正，預期消除4例，其他3例暫留；不改evaluator、不開FT7。

最新：lock timing修正 [run 36253842718 驗收通過](audits/cc2-alignment/RESULT_36253842718.md)，65例由7差異降至3，僅4個預定案例改變，其他61不變；Rust Forecast 9 tests passed。保留修正，下一步獨立queue scan，暫不修storage或替換production。

更後續：queue scan [run 36254310327 通過](audits/cc2-alignment/RESULT_36254310327.md)，69例僅剩storage clipping一例，Rust12 tests passed。保留timing+queue修正。下一步40bit截斷及邊界測試，failed-insertion另辨識；尚不進FT7或production。

## 固定目標與目前決定

最新：[run36311975213 observer問題](audits/cc2-alignment/RESULT_36311975213.md)：96手40 mismatch只在tanked/cancelled/sent且加倍，Bot.current與Dag.root各advance一次被同observer重複計數。raw40非空events前後半相同，单次重算96手零transaction差異；90623 edges/4542 selection replays/depth6無assert失敗。正式gate未過。已改Bot.current.advance後drain committed sample，DAG replay另取且要求相同，重跑同corpus；未改bot規則/production。

最新：建立[4手trace＋DAG replay audit](audits/cc2-alignment/TRACE_PLAN.md)：本機24traces/96placements生成通過，persistent Bot不補queue，每step對authority transaction及known pieces。診斷observer記published parent/next/move→child，Dag::select重播核fullstate；要求actual replay及depth>=2，禁止speculated expansion。combined workflow先重跑2038 checks再trace，查最新run的cc2-trace-results；Rust尚待驗證。production未改。

最新：[run36309185307 combined gate通過](audits/cc2-alignment/RESULT_36309185307.md)：2038 checks零差異，最終cache build Forecast16/spawn5/snapshot8 tests通過，movegen6 tests通過。本機重跑spawn/air gate、raw72transition comparator、6boundary與Hold/rotation驗證。保留combined candidate。下一步多手known-prefix authority trace＋DAG selection replay/stored-child一致性，然後browser budget；production/evaluator未改，不開FT7。

最新：建立[combined correctness workflow](audits/cc2-alignment/COMBINED_PLAN.md)，四transaction corrections先套，再加movegen/spawn/air；最終cache build重跑transaction＋lifecycle＋snapshot，合併gate共2038 checks。查 `CC2 Tetrp combined correctness` 新workflow（不是舊movegen）。本機72fixtures/6boundary expectations重產成功，Rust整合結果待Actions。尚未做多手authority/DAG trace，production未改。

最新：[run36308069080 Hold/reveal驗收](audits/cc2-alignment/RESULT_36308069080.md)：30 Rust requests零差異、8 hidden-tail pairs相同；16 authority Holds後14次locked reanalysis無Hold候選，2 terminal不重分析。本機核raw output與pairs；141 lifecycle/1746 rotation/43 placement-cost回歸通過。Rust5 spawn+8 snapshot+6 movegen通過。下一步將transaction四項修正與movegen/air/spawn整合於同一diagnostic build，重跑combined suites，再查多手state/DAG replay一致性；未接production、不開FT7。

最新：[run36307348238 spawn修正驗收](audits/cc2-alignment/RESULT_36307348238.md)：141 cases零差異、8 baseline cases修好、其餘輸出不變；5 spawn tests含二層DAG通過，1746旋轉/43落點回歸通過，本機重算gates。已保留隔離修正。接著建立[standalone Hold/reveal audit](audits/cc2-alignment/SNAPSHOT_HOLD_PLAN.md)：30 requests、8 hidden-tail pairs、16 authority Holds，本機generation通過；Rust實際parse/post_hold_root/analyze_text待Actions。production未改。

最新：已建立[spawn-terminal隔離修正](audits/cc2-alignment/SPAWN_FIX_PLAN.md)：GameState增加empty-Hold lineage旗標納入hash，actual current的spawn/clutch guard套在DAG expansion與public API，authority active-root allowlist豁免respawn。141配對fixtures含8個empty-Hold反例控制與terminal try_play；要求至少6例修好、其他已通過輸出不變。Rust與二層DAG測試等Actions，尚未宣稱修正驗收。production/evaluator未改。

最新：[run36306243988完整驗收](audits/cc2-alignment/RESULT_36306243988.md)：133 cases零technical errors；同6個terminal-spawn被Hold救回差異重現，其他127 measured checks一致。1746旋轉零差異、43落點/cost回歸過，已本機重核raw lifecycle與air gate。下一步單独spawn-terminal修正，先區分active root/post-Hold/deep spawn與empty-Hold normalization；不能一律next_moves空就判KO。需增加terminal狀態try_play拒絕測試。Production/evaluator未改、不開FT7。

最新：[run36306028349部分結果](audits/cc2-alignment/RESULT_36306028349.md)：Rust133 rows正常輸出，但2個sealed fixture含滿行被拒，JS gate中止，後續回歸未跑。131正常rows中6例確定current spawn KO卻仍rank Hold落點；未見其他queue/refill/locked Hold差異。已修fixture為column0留洞、Rust保留error id、JS先落盤technicalError再fail。重跑同133 cases，不改production或先修核心。

最新：建立[Hold/spawn/clutch第一輪](audits/cc2-alignment/LIFECYCLE_PLAN.md)，133 conditional fixtures（36 spawn KO、33 clutch rescue、20 Hold attempts）。Rust真正Bot API＋一次完整DAG展開檢查terminal current是否被reserve救回，以及macro Hold取牌／refill。Snapshot standalone Hold重分析尚待另查。Workflow加入此診斷與ntfy，讀最新artifact的cc2-lifecycle-results；尚未取得Rust結果，不先宣稱bug。未改production/evaluator。

最新：[run36305563250已驗收](audits/cc2-alignment/RESULT_36305563250.md)：1746 spawn-reachable rotation probes，兩Rust版本對authority acceptance/cells/spin零差異；43組placement/cost回歸通過，本機重算raw output與air gate確認。Rust6 tests／JS8 tests通過，ntfy accepted。保留isolated修正，不因前輪conditional integer案例擴充表示。下一步Hold／spawn／clutch lifecycle differential；external integer snapshot支援域仍待整合前明確處理。Production未改、不開FT7。

最新：已建立[spawn-reachable rotation 診斷](audits/cc2-alignment/REACHABLE_ROTATION_PLAN.md)，本機1746 probes、71507 prefixes通過，包含history30/31+、kick3、180、mini/full；零integer pose、零certificate差異。14條額外旋轉後接原路徑失敗已記錄，未納入失敗後姿態。Workflow改用此corpus，下一次查 `CC2 Tetrp movegen diagnostic` artifact；Rust結果未得前不宣稱parity。原564 conditional probes generator保留可重跑。

最新：[height domain 審查](audits/cc2-alignment/HEIGHT_DOMAIN.md)完成。正常 default TL generated lineage 的 y 寫入都保留非整數；新增5 tests及 replay16 tests共21通過，包含40×/無限緩降、實際40次旋轉、垃圾推升、restore/fork、anchor不覆寫。外部checkpoint確實接受整數y，且同cells旋轉不同，不能無條件normalize。暫不因186個conditional probes擴充核心；下一步以spawn實際可達路徑建立kick/180/history fixtures，再跑Rust雙版本。完整domain／spin parity尚未認證，production未改，不開FT7。

最新：[rotation run36293876659](audits/cc2-alignment/RESULT_36293876659.md)完成。564條件probes中186差異，全為精確整數current.y且history0／30；spin18皆伴隨cells差異，沒有spin-only。兩Rust版本完全相同，43例movegen回歸零差異。已實查同cells的y38與37.96旋轉不同、後者與CC2相同。下一步先確認正常Engine/replay是否能產生精確整數y，再決定表示或明確支援域，不能把條件probe失敗率當實戰錯誤率。10個authority certificate邊界仍待可達性辨識，不混修、不開FT7。

最新：[空中摘要run 36293197534](audits/cc2-alignment/RESULT_36293197534.md)已驗收，本機重跑gate成功。43例candidate/shared-cache與完整reference逐筆placement及cost一致、authority集合零差異；warm倍率中位0.3186（約3.14×），cold無穩定加速結論，27entry payload170688bytes。保留隔離候選，不接production。下一步原定kick／180／rotation-history專項，同時跑兩個Rust版本以區分規則模型與cache差異；不要只對43例持續微調效能。未來timing-aware execution需求已記錄，現在仍placement模型。

最新：[成本剖析run 36291812974](audits/cc2-alignment/RESULT_36291812974.md)完成，本機重跑gate通過；39例placement及cost完全一致。23172次展開中93.18% airborne，stale pops只占2.38%；這是工作量、不是CPU時間比例。下一假設為壓縮遠離障礙的空中路徑、保留邊界狀態最小cost及近障礙逐格展開；不可直接above_stack剪枝。尚未實作該優化，production／evaluator未變。

最新結果：[中途下降 run 36291220869](audits/cc2-alignment/RESULT_36291220869.md)已驗收：39例1275個cells+spin落點全等authority，baseline7例漏搜補回；但kernel耗時倍率中位26.77×，294筆既有soft-drop cost變動。僅保留correctness reference，暫不接production／DAG。下一步同一movegen內profile與降低展開成本，保持完整集合，cost語意另列相容性議題；不調weights、不開FT7。

目前最新：[spawn movegen run 36290851396結果](audits/cc2-alignment/RESULT_36290851396.md)已下載並重算。26/27例cells+spin集合相同，605個authority落點中CC2缺1個J中途下降再左移的落點，無CC2-only或同cells spin差異。Witness重新驗證通過；full drop多掉1格後不能左移，吻合fast path省略中間下降pose的風險。下一步只做這類geometry展開的介入修正與配對回歸，不調evaluator、不開FT7；詳細限制見報告。

最新進度：[failed-insertion run 36290267203驗收通過](audits/cc2-alignment/RESULT_36290267203.md)。原72個placement案例comparisons完全不變、6個primitive邊界全部對齊；Rust兩邊各16 tests passed，ntfy accepted，本機已重跑gate。保留四項局部transaction修正。下一步CC2 movegen／spin provenance集合差異審查，再查Hold與spawn／clutch；不開FT7、不改production。

最新驗收：storage clipping [run 36254801181 通過](audits/cc2-alignment/RESULT_36254801181.md)，72例由4差異降至0，其餘68例comparisons不變；Rust候選15 tests passed（包含一項已知bug characterization，不能混當parity）。保留timing+queue+storage修正。下一步單獨修failed-insertion先扣pending的交易順序，再進movegen／Hold／spawn。Production未替換、不開FT7。

目標仍是做出能在公平 TL S2 KO arena 贏過 Legacy、且能在 Tetrp 純前端運行的 Kiwi。停止的是目前 Native v0 beam 的局部救援與全層 lookahead 候選，不是放棄目標。

使用者提供兩個 upstream branches，希望回頭檢查當初為何未完全對齊。現在選定的下一步是：**以現行 kiwi-v1 為起點，審查 CC2 搜尋內部與 Tetrp authority 的規則耦合；tetrp-authority 作為歷史實作及測試來源。** 不直接合併 branches，不退回舊 adapter，不先調 evaluator，也不現在另造搜尋器。

使用者對反覆提出又撤回方向已非常不滿。不要把猜測講成已知根因；不要被追問後沒有新證據就換方向；不要把性能／heuristic score 改善宣稱為勝率改善。

目前只完成初步 branch/source 對照，**尚未完成可移植性審查，尚未承諾或實作規則核心移植**。這一輪交付應是有具體函式與差異案例支撐的耦合表、保留／替換範圍及最小可驗證方案。

## 不可退讓的邊界

- Tetrp Engine 是唯一 gameplay authority。外層 arena 正確不等於搜尋腦內的 transition 正確。
- Bot 只接 PublicSnapshot：current、exactly NEXT 5、Hold/availability、board、公開 counters/rules/timing/pending。
- 不讀原 replay future、private checkpoint、bag/hole RNG、opponent future；不使用 piece history 或 piece-count modulo 推 bag。舊 branch 文件若允許歷史 bag inference，已被現在要求取代。
- 未知 future 用明確假設或停止；不能把真實 hidden future 或假設 scenario 的未 reveal 資訊偷交給 policy。
- 固定 cadence 的 strength arena 使用 authority-validated direct placement commit，保留 spin/path provenance，不透過 keyboard transport 重新選落點。Top-1 失敗是 technical failure，禁止 silent fallback。
- Hold 為 standalone action，authority 執行後 reveal 新 snapshot 再分析。
- 勝負只看 KO；雙方同 piece seed、相同 24 frames/placement、每局換 seed、交換座位。沒有一般 frame cap 判勝；watchdog 是不計分技術異常。Mirror 不重複當獨立樣本。
- 靜態前端、Worker、本地運算、PWA；不依賴 backend、SAB／threaded WASM。若用 WASM，完整 hot kernel 留在 WASM，避免逐 node 跨 JS/WASM。
- 不重做 replay viewer、Phase 4 架構、Tetrp Engine；不現在抽獨立 package/TBP。

## Repo 與精確版本

Tetrp workspace：`C:\Users\jush\Documents\ChatGPT\Tetrp`。

- 本地 branch：`codex/kiwi-ft7-actions`
- 已提交 HEAD：`b2529f23a517b2e16f9b6fe9e6c460fa5bc18d6e`
- **下面多數近期報告、scripts/tests 與兩項 Native 修正尚未 commit/push。它們存在工作目錄，不能只看 HEAD 判定現況。**

2026-09-26 `git ls-remote` 實查 upstream：

|Branch|Commit|
|---|---|
|https://github.com/jush0147/cold-clear-2/tree/kiwi-v1|`2e243242b674d57491f99b445f75e35fc48a0e26`|
|https://github.com/jush0147/cold-clear-2/tree/tetrp-authority|`dbdc6b90dca50a79c0ee76047227c55e5a089dcb`|

`vendor/kiwi-v1/kiwi-build.json` 指向 kiwi-v1 同一 `2e24324`，產品版本 snapshot-v3.2。現在對戰稱 Legacy 的就是該 packaged snapshot adapter/core，不可與 upstream 原版 CC2 混稱。

只讀審查 clone：`.cache/cc2-branch-review/`，以 `git clone --filter=blob:none --no-checkout` 建立，尚未 checkout。使用固定 SHA 或 `git show origin/kiwi-v1:<path>` 讀取。Partial clone 可能按需抓 blobs，網路操作要相應權限。不要把這個 cache 當正式實作 repo。

## 已從原始碼確認的初步發現

1. `git diff --quiet` 比較兩分支的 `src/data.rs`、`src/dag.rs`、`src/dag/known.rs`、`src/dag/speculated.rs` 回傳 0：**這四個核心檔在兩個 heads 相同**。不是說整個 repo 或所有搜尋相關檔相同。
2. `kiwi-v1:src/bot/freestyle.rs` 展開候選後呼叫 `state.advance(next, mv)`，再用 resulting state + PlacementInfo 評分，並建立 DAG children。
3. `src/data.rs` 的 GameState 仍持有 board、bag、reserve、B2B、combo、TetrioRules、Forecast。`advance()` 自己更新 bag/reserve、落子消行與後續交易，並呼叫 `forecast.resolve()`。因此 branch 名字帶 authority 不表示深層搜尋使用 Tetrp transaction。
4. `src/forecast.rs` 是明確的 hypothetical model：有限 packet array、scenario 洞位、自己的 activation/clock/cancel/tank 邏輯。`resolve()` 先增加整個 placement 的 elapsed_frames，再處理 attacks，零消行時以固定 `0..8` 迴圈入垃圾、從隊首判斷 readiness。需要與現行 Tetrp 的 lock frame、FIFO/可跳過未 active packet、cap、blocked semantics 逐項做差異測試；**尚未量化實際策略影響，不把 code-shape 差異全當已證實 bug**。
5. `kiwi-v1` 的 root Place 可以使用 authority-derived complete current-pose allowlist；post-Hold hypothetical root 與更深層仍使用自己的模型。Root geometry 正確不能推論 deep transition/spin/clock 全對齊。
6. `tetrp-authority:scripts/lib/tetrp-authority-adapter.mjs` 舊實作維護 observed piece history/frontier bag state；migration plan 也明示此做法。**不符合現在 snapshot-only 要求，不可整包搬回。** 這不是說當前 vendored snapshot-v3.2 在使用該歷史推 bag 路徑。
7. `tetrp-authority` 頂端 commits 多為 snapshot-v2/v3/v3.1 驗收紀錄；kiwi-v1 有 snapshot-v3.2 adapter/worker 等修復。不能僅因名字，假設 authority branch 較新或較完整。
8. Vendored capability ledger 明確承認 exact ARE/bump、full clutch、full opening-double-cancel 等 parity 未完整。舊文件含 superseded entries，必須對照目前 source，而非逐條當成現況。

已讀：兩分支 diff/stat、authority migration plan、舊 authority adapter 前段、DAG known 前段、freestyle 展開、Forecast、GameState advance 片段、vendored build/parity ledger。尚未逐行完成整個 DAG/backprop/hash/transition/adapter 的審查。

## 下一個實際工作：搜尋內部耦合表

沿著以下資料流追蹤，不先開新對戰：

`PublicSnapshot → snapshot/analysis adapter → search root → DAG select/expand → GameState::advance → attack/Forecast → eval/reward → state hash/merge → backprop → root recommendation`

至少檢查：

- `src/snapshot.rs`, `src/analysis.rs`, `src/bot.rs`, `src/bot/freestyle.rs`
- `src/data.rs`, `src/movegen.rs`, `src/forecast.rs`, `src/tetrio/*`, `src/ko_support.rs`
- `src/dag.rs`, `src/dag/known.rs`, `src/dag/speculated.rs`, `src/map.rs`
- `scripts/lib/kiwi-snapshot-adapter.mjs`、snapshot worker、root geometry helper
- 舊 authority adapter/match runner 和 rule fixture exporter，僅作歷史證據

逐項輸出：現行 CC2 語意、Tetrp 對照函式、確定差異／尚待驗證、可保留／需替換／耦合阻礙、最小 differential fixture。尤其注意：

1. 已知資訊下的 deterministic transition 對齊，與未知 tail/hole 的模型假設分開。
2. Clock/garbage/Surge 等增加 state 維度後，DAG merge、hash、evaluation cache、backprop 與 horizon 是否仍合法。
3. Same cells 但 spin/kick provenance 不同不能盲合併。
4. Hold draw consumption、空 Hold reveal 邊界、snapshot statelessness，以及既有 bag/speculation assumptions 是否可安全關閉／替換。
5. CC2 search 是否能與完整 Tetrp-native state/transition 分離。不能假設 generic Evaluation trait 就代表 GameState 抽象化了。
6. Rust/WASM search model 如何共享或移植 pure rule semantics、用 Tetrp differential oracle 驗證；不要把逐 node 呼叫 JS Engine 當效能方案。

交付最小移植範圍與耦合證據後，再決定具體實作。現在不承諾全面移植可行，也不因遇到耦合就自動轉成新搜尋器設計。

## Native 工作：保留／已結束

### 保留（本地已修改）

- `src/analysis/native/model.js`：post-lock 下一個 decision frame 啟用 surviving garbage packets；不可回溯在上一個 lock tank。Unknown activation 維持 frontier，完全取消封包不產生假 frontier。
  - 修改前 360 synthetic conditional fixtures 中 69 個只差 active flag；修正後 0 mismatch。
  - 修改前 1542 個同下一手比較已顯示無 transaction 差異，**未證明它是 0–7 的原因**。
- `src/analysis/native/movegen.js`：同一次 generate 內 drop suffix destination cache。
  - 84 組輸出差異測試 + 2 組完整 rotation-history case 相同。
  - Node 45 pairs 中位延遲降低 20.11%；Chrome Worker 45 pairs 降低 22.95%；search candidates/score/work/TT parity 相同。
  - 固定 1000ms 一次配對檢查：15 states 中 5 個 depth 1→2，無深度退步。不是 strength evidence；正式 geometry budget/evaluator 沒改。
  - 完整回歸 **443/443 passed**，log `.cache/kiwi-cost-full-tests.log`。

### 已結束，不重啟為「新假設」

- 根據少數固定 root 的 KO 結果做價值標籤：pilot 與 replication 未穩定重現。Replication run `36037724891`，48 matches、22840 placements、7710 Holds，correctness 通過。
- 純 generated APP candidate：run `35886665683`，有效 Native 0–7；generated APP .1948 vs .6429。不是「只是攻擊強但不會活」。
- inventory2、queue-progress2、root-fair quota：依事前門檻失敗。
- 全層 one-ply lookahead：固定 geometry budget 未通過；加速後同 1000ms 的最後檢查也失敗。
  - 15 states × 3 pairs = 90 searches，45 pairs top-1 完全相同，所有 request completed depth 2。
  - Candidate 45 次皆 partial-probe stop，0 reused published children。
  - F48 三次 depth2、Legacy-root score -0.80，未找到四手 +0.55 witness。
  - 90 個 root/Hold authority checks 通過，max duration1003.5ms。未啟動 FT7、未接入 production。
  - Browser transform 抽出 `transformLookahead()` 僅為離線重用；三個 targeted tests passed。Production search.js 沒改。

## 證據入口

- [Native 診斷](audits/NATIVE_DIAGNOSIS_2026-09-26.md)
- [同 snapshot root 分歧](audits/kiwi-root-disagreements/README.md)：F24 tie、F48 depth3 pruning、F120 horizon。不是 Legacy action ground truth。
- [root-fair 搜尋配置](audits/kiwi-search-exam/README.md)
- [APP 結果](audits/kiwi-app-result.md)
- [root KO replication](audits/kiwi-root-ko/REPLICATION_RESULT.md)
- [固定 work lookahead](audits/kiwi-lookahead/README.md)
- [效能剖析與保留加速](audits/kiwi-cost/README.md)
- [最後 fixed-time lookahead，已否決](audits/kiwi-lookahead-time/README.md)

各目錄有 PLAN、manifest、result/summary JSON。結果與 scripts 多尚未追蹤，請保留；不能以乾淨 checkout 當作目前工作全部已提交。

## 操作注意

- 使用者希望長時間實驗／對戰交給 GitHub Actions，不持續盯場；完成／異常 ntfy topic：`just_a_kiwi_for_tetrp`。已有明確發通知授權，不需每次再問。現在沒有排程、進行中 arena 或 browser benchmark。
- 下一步是 source review，不是新的 tuning／FT7。Browser benchmark 用 installed Chrome (`channel: chrome`)、headless、localhost fixture server；已關閉 browser/server。
- 最後一次 git status 中有其他工作：`third-party/kiwi-notices.md`、`.codex-remote-attachments/`、`docs/UI_TEXT_INVENTORY.md` 與本工作無關，不要刪改或一起 stage。不要 `git reset/clean` 丟掉未提交紀錄。
- PowerShell。完整 Python oracle tests 使用 `.cache/python-runtime/cpython-3.12.13-windows-x86_64-none/python.exe` 設為 `$env:PYTHON` 再跑 `npm test`。外部 network／必要 subprocess 操作遵守當前權限。
- 不因記錄／交接而自動建立新任務、merge、push、開跑 experiments；不宣稱背景工作會自行繼續。下一次接續從上面的耦合表開始。

## 2026-10-02 overnight strength batch

User authorized the prepared visible-T versus accepted CC2-based profile:
[fixed 200-game plan](audits/cc2-alignment/VISIBLE_T_200_PLAN.md).
100 new paired seeds, 200 KO games; 16 runners maximum, two isolated matches
per runner, frozen verified native kernels and parallelDecisions. No new
performance pilot or evaluator change. H9-off/H1-off are not queued. Await
one ntfy completion/failure message; inspect full correctness and paired
outcomes before deciding next step. No automatic promotion or score-based
extension. Dispatch identity is recorded separately once confirmed.
