# 低成本剩餘資源估值：第一版具體設計

2026-10-06。依[唯一主線](RESIDUAL_VALUE_DIRECTION_2026-10-05.md)進行設計。本次沒有修改bot、沒有派Actions／對戰。結論是提出一個可否證的局部替代：**延後兌現的結構改善，不再當作已經取得的盤面改善**。不宣稱已證明現有決策錯誤，也不宣稱已完成所有資源的統一估值。

## 1．核對實作，以及沒有重做的工作

核對accepted source mirror `.cache/cc2-parameter-audit/src/{bot/freestyle.rs,data.rs,forecast.rs}`、`dag/known.rs`，及`.cache/cc2-spawn-source/src/dag.rs`。freestyle.rs SHA256核對值為`9fe27a686c21515eb729af2ec73c4b99cd0ad6201b783fd35319a93c265f03d1`；source pin／accepted patch沿用既有紀錄。

- `do_work`現有child transition先算`GameState.advance`，再`evaluate`；node budget在每次child transition計費。候選不新增transition。
- `evaluate` H1、H9在真實post-transition board上算。之後以synthetic bag、reserve計算T cutout數，找固定T-slot模板，虛擬放T；消超過一行時修改局部board，最後才算holes、coveredness、井深、高度、transitions。
- 因此現有T-slot價值包括「直接slot bonus」及「把結構先消掉後，整套board評分的差值」。不是只有一個TSD bonus。
- `GameState`有reserve、hold_is_empty、combo、B2B/count、forecast；沒有完整剩餘queue。`Selection`能知道layer與depth，既有visible-T候選已示範如何取得known suffix，不能靠bag或總piece數推回queue。
- forecast有剩餘公開packet、情境ready_at、clock／frames_per_piece，但packet為private；若需讀deadline，須新增唯讀摘要介面，不複製一套garbage交易。
- DAG展開後回傳child value + edge reward，替換未展開leaf估值，並非一路把所有leaf值相加。

既有完整score trace、work allocation、authority對齊結果沿用，不再做一輪相同診斷。既有visible-T沒有確認改善，不能把「沒T就不cutout」重新包裝成新成果。

## 2．保留與替換範圍

令`R0`為accepted edge reward（實際sent、既有clear shaping、wasted-T等），全部保持。

令`S(s)`為真實board上的H1、H9及原有B2B leaf項；保持原語意和數值。H3 charge/bank目前零值仍為零，**不順便加Surge bonus**。令`G(B)`為現有base board評分：holes、coveredness、well、height family、row transitions，原係數保持。

替換現有整段T-slot cutout估值，而非調某一係數：

    舊：V0(s) = S(s) + Σslot_bonus + G(B_after_cutouts)
    新：V1(s) = S(s) + G(B_real) + g(s) × A(s)

    A(s) = max(0, slot_bonus(l) + G(B_template) − G(B_real))

`B_template`只用原本left-first/right-second模板偵測，最多**一個**T資源，不枚舉所有slot、不串接第二個虛擬T。模板occupied cells須在board內且不重疊已有cell；不存在或檢查失敗則A=0。沿用原規則：l>1才從局部board移除模板完成的行，l<=1保持B_template=B_real但可有原slot bonus。這不是合法path／spin證明，不計TL攻擊，不輸出成policy action。

一次只為一個明確模板計估值，避免多個未知T構成未經搜尋的虛擬消行鏈。`max(0,…)`代表可不使用資源，而非逼bot使用負價值模板；這也是候選假設的一部分，不是純代數重排。

本候選是一個完整「cutout資產估值機制」替換，包含real-board基準、單資源上限、可放棄性與等待折減；**不是單一係數消融**。若成功，不能單獨歸因其中某一項；若失敗，不自動拆成多批逐項補救。

## 3．具體折減公式與資料定義

    g(s) = 1 / [ d(s) × (1 + P_due(s,d) / C(s)) ]
    C(s) = max(1, board_visible_height − max_column_height(B_real))

`d`為「最早能使用一顆T」所需未來placement數估計，>=1：

- 從post-transition normalized public context取得真正的current/reserve/known suffix。T在當時可用的current或合法非空Hold時，d=1。
- 否則為known suffix中第一個可用T的最早lock序號。這只證明供給上可用，沒有證明等待動作能維持slot、spawn或安全。必須包含empty-Hold normalization語意，不能把reserve一律當成Hold，也不能把原root hold lock套到所有descendant。設計上以短prefix的piece/Hold供給表求最早序號（不枚舉board落點），按layer與reserve/empty狀態預先建立；不能直接把raw queue index當lock數。
- 若已知prefix的n個可用lock都沒有T，使用d=n+7。這個7來自明示IID等機率piece假設、一個lock讀一個新piece的平均等待，**不是實際SevenBag條件分布，不是bag remainder inference**。未知區不模擬empty Hold額外reveal，故這只是供給延遲proxy，不是完整Hold模型的精確等待期望。使用平均等待的倒數作簡單折減，不冒稱`E[1/d]`、兌現概率或勝率。
- leaf仍有known suffix時必須用其順序，不把它提早當未知；到真正finite frontier時才使用未知等待假設。不得偷看private queue或piece history。

`P_due`為既有scenario裡、從leaf時點到第ceil(d)個lock（含該lock）已ready的剩餘公開packet總行數。時間完全由forecast的clock/cadence計算，不硬塞另一套24-frame時鐘。stationary-clock snapshot不假造時鐘前進，未知activation沿用原scenario假設。n、d與deadline只用公開的有限prefix／明示IID假設。

`P_due`不是預測實際進場：等待中可能cancel、combo blocking、分次tank；這裡全部未知。使用它只是折減尚未兌現資產的風險proxy，不在真實board插入垃圾、不扣packet、不給cancel分、不模擬未來动作。C也只是可見高度空間proxy，**不是spawn/clutch/topout裁判**；高度>=20時仍保留C=1，不直接宣判死亡。

原H1反映當前盤面對pending的脆弱性，這個折減反映「改善還要等待」；兩者並非重算同一transaction，但可能過度重疊懲罰，必須列為失敗風險，不能聲稱數學上已消除所有proxy重疊。

公式沒有新增可調weight表，但`1/d`、`P/C`與單資源上限本身就是人工模型選擇。**少了調參旋鈕，不代表免除heuristic假設或得到第一性原理的唯一答案。**不在初次結果後調它們來追勝率。

## 4．多衡量了什麼，沒衡量什麼

新增的是「同一結構改善需要等待多久、公開壓力相對剩餘空間有多大」的交互作用，不是再增加generated attack或漂亮盤面的獎勵。

例：假設同一模板的A=8（純示意、非實測），其餘相同：

| 條件 | 資產估值g×A |
|---|---:|
| T可立即用，無due incoming | 8 |
| T要到第5手才可用，無due incoming | 1.6 |
| 下一手可用T，C=2、due incoming=8 | 1.6 |
| 已知5手沒T、IID等待7手，無due incoming | 約0.667 |

後兩項不代表必死或一定不能兌現，是保守折減假設。尤其立即T可能真的能clear/cancel而保住結構，P/C會低估它；這是已知弱點，不新增免費transaction preview修補。

與visible-T不同：舊候選只換T數量，允許完整cutout、不看位置與deadline，無T時零資產。新候選估的是等待成本與有壓力時的可利用程度，未知T也不硬設零。這個區別構成新假設，但舊97–103結果仍是警訊，不保證新版本有效。

與失敗Native不同：保留CC2既有R0、搜尋與已算到的防守／延續；真實board之外仍有明示的資產估值。不把所有資源換成sent減三項靜態懲罰。但它仍依賴既有G的尺度／特徵；不能說已經解決靜態proxy的一切問題。

第一版**沒有**新的Surge兌現概率、全盤垃圾可處理性、I-well使用時機、完整Hold flexibility模型。B2B/Surge實際交易及搜尋延續保持；其中未知長期價值仍不完整。此設計是大方向下的第一個局部機制替換，不用一次全改的名義掩蓋範圍。若要求現在一次完整替換所有leaf特徵，本設計不滿足，不能擅自擴張。

## 5．不重複計價與state identity

- 只替換leaf V；R0不改。不在每個edge再加A，也不把hypothetical模板attack算成sent。
- 真正搜尋執行T clear後，子狀態從真實新board重新算V；父leaf資產值由backprop取代，不能帶入累計Reward。
- T供給context必須對同一layer/GameState唯一。以normalized immutable suffix及layer位置提供，不能混入到達路徑的累計收益。TT不能讓不同suffix共用同一value；現有分層DAG先核對此條件，若不成立便停，不啟動搜尋重寫。
- synthetic bag不參與新asset估值。未知piece分布只用固定IID prior；保留GameState既有bag欄位不等於允許用它推斷真實future。
- board/template全部局部唯讀或局部副本；不影響policy top1 certificate／authority commit，也不允許fallback。

## 6．成本：有上限，不先宣稱免費

不加movegen、不加GameState.advance／forecast.resolve、不生成額外search node、不改selection或budget/stop。使用既有bitboard及模板掃描。

增量成本：G(B_real)與G(B_template)至多兩次（可同一次column掃描讀兩份board）；known suffix最長固定公開prefix，應在每個layer預先算T位置，不能每node重走DAG；due摘要最多掃既有16packet，可按有限d deadline在同一forecast讀出，不跨request用cache。原先可做多次cutout，候選至多一次，但這不證明總時間下降。原H1已有board danger資料，可局部重用；不另起快取／profiling優化專案。

額外一次G可能使本候選不符合時間要求；這是實際gate，不用「仍然200k」掩飾。若成本超標即停止此候選，不能轉成效能支線來拯救它。

## 7．下一階段的固定交付與門檻

此文先交付設計，不自動實作或派送。若續作，僅此一候選：

1. 隔離build，off完整report重現accepted。擷取少量既有snapshot中的B_real、template、G差、d來源、due/C、A/g/V；不重做完整歷史trace，不用人工喜歡的top1當通過標準。
2. 單元／對照：沒有模板A=0；g在(0,1]；固定A時延遲／due上升不增值；負資產可放棄；實際clear後不重算舊資產；known suffix/T in Hold/empty Hold各種normalization；改hidden future不影響值；bag欄位變動不改asset；stationary與timed clock deadline與forecast一致。
3. 不承諾所有T模板可达；確認模板只估值、不能繞過authority。機制on無須與accepted report相同，但top1／Hold／spin／cells／frame／clear仍必須authority parity、零fallback。
4. 事前固定12 perf +8 Surge public snapshots、相同200k、原stop，交錯完整request latency與尾端延遲；初篩on的總時間、中位數及p95均不得高於off，逐輪與每state完整報告。單runner短測不算browser證據；若初篩通過才另做固定browser Worker確認。未通過就停，不追加到通過。
5. 確認有實際asset/value activation及root影響才值得arena。沒有root影響不自動提高力度。KO計畫需在候選凍結後另定，不能在設計階段私自派200場；KO是唯一強度採用依據。

可能失敗：G差本身誤估、模板可達性幻覺、壓力折減錯過防守性T clear、IID平均等待不合適、单asset低估連續攻勢、評分引導search剪掉setup、成本超標。任何一項都不能靠「看起來合理」忽略。一次候選的結果是對整體此機制的證據，不證明其他資源全無用或evaluator必為唯一瓶頸。
