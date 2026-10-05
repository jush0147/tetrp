# 替代 evaluator：第一次設計審查（未實作／未派送）

2026-10-05。使用者授權設計審查，不修改bot、不新增Actions。目標仍是公平KO勝率。這份設計不是已證實的故障定位，也不是改善承諾。

## 1. 核對的實作與證據

accepted配置見ACTIVE_PARAMETERS_2026-09-28.json；實際已驗收binary SHA `386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb`。閱讀本機已保存的accepted source audit：src/bot/freestyle.rs、snapshot.rs、analysis.rs、forecast.rs、data.rs、dag/known.rs，並對照Tetrp src/attack.js、placement-authority與最近arena驗收。

freestyle.rs SHA256 `9fe27a686c21515eb729af2ec73c4b99cd0ad6201b783fd35319a93c265f03d1`，與兩個正式候選build的source-delta中未修改evaluator本體hash相同。閱讀的是具體accepted實作，非stock CC2描述。此前authority對齊證據沿用；本次不聲稱重新驗證全部規則。

- 邊的Reward包括實際newly sent，以及legacy clear shaping、wasted T等；accepted tetrio_s2=false，不代表沒有TL S2交易。useful_attack_reward=1，cancellation_reward=0。
- Forecast.resolve確實先處理公開incoming的cancel，再在未消行時嘗試進垃圾；攜帶clock、pending、pieces/sent及opener狀態。抵銷會影響後續board與pending safety，所以「cancel沒直接加分＝沒算防守」不成立。
- attack.js真實authority逐packet處理Surge、ordinary、AC，opener额外防禦不會變成對外攻擊。多種交易不能簡化成generated=sent，更不能把tank冒充cancel。
- DAG known-layer的child cached_eval=child evaluation+edge reward；展開後parent取得最佳child，再向上回傳。已搜尋的延續會計價。把同一延續的attack再加成asset會重算。
- 未展開節點及known frontier使用handcrafted Eval；包含H1/H9真實board成本、Boolean B2B、T-slot template cutout、cutout後holes/coveredness/height/transitions/井深。不是所有leaf都用完visible queue。
- T-slot cutout是估計：在本地複本放T、消行，再評board；不是authority證明的未來行動。此事實不等於已證明它導致輸局。
- snapshot分Place/Hold各一半budget；empty Hold只能先用已知prefix估值，再由authority reveal後重分析。Place/Hold的available known horizon並不總是相同。
- 根據公開incoming有1／10／30 scenarios，每個分配同一200k總預算。未知activation是三種敏感度假設，不是已知真實分布；不能把scenario平均叫真正勝率。
- 現有finite-visible不搜真實NEXT5之後。沒有對手後續policy模型；不能把newly sent當對手必定接入，更不能把score當KO概率。

## 2. 從勝率拆解價值

需要衡量的其實是：行動在未知未來中，能否維持可延續性，同時把自身資源轉成對手無法化解的壓力。這包含死亡、攻擊的時間與分布、自身垃圾能否處理，以及尚未兌現的資源。

PublicSnapshot沒有完整對手state，因此無法直接計算「此攻擊的KO概率」。現有sent代理與board尾端估計仍是近似；更換公式不會自動補齊缺失觀測。

可區分為：

1. 已搜尋交易：sent、cancel、tank、combo/B2B/Surge變化、合法落子、死亡。由同一對齊模型計算，不能獎勵同一交易兩次。
2. 已知但尚未搜尋的可達後續：主DAG應繼續展開；另外評這些後續，本質是增加／重新分配搜尋，不是發明新價值。
3. 可見prefix用盡後的剩餘能力：目前主要靠形狀與固定bonus估計，是可以明確替換的一個邊界。
4. 未公開piece／hole／對手攻擊：只能採明示假設，不能讀private engine或把假設稱authority事實。

## 3. 我選的第一個設計：一個未知piece的情境平均frontier value

不支持立刻清空所有參數。先替換「known prefix完全用盡」時的估值方式；搜尋的movegen、DAG、TT、rules與online input保持目前架構。新hypothesis只有：**依不同下一顆實際可做的合法動作估算邊界價值，是否比直接對現有board打分更有用。**

令R0、V0分別為目前accepted的edge reward與state evaluator。對真正known frontier s：

    V1(s) = (1/7) Σ[t ∈ I,O,T,S,Z,J,L] max[a ∈ legal(s,t)]
                     ( R0(s,t,a) + V0(transition(s,t,a)) )

這是一次stochastic Bellman backup，也可稱一層未知tail extension；**不是全新feature清單，也不是純粹零成本evaluator調整**。我修正先前籠統的「重寫evaluator」提議，先做這個可獨立否證的frontier替代，避免一次改reward、安全與搜尋而失去歸因。

- 假设7種piece等權，沒有bag remainder、history或modulo推論。不宣稱是條件SevenBag的真實分布。
- max在每種piece內：到那個未來時點已看到piece，才能選該情境行動；不是先挑對自己最有利的piece再計分。
- 每種情境只模擬一手。使用合法movegen、Hold state、spin/kick provenance、TL transaction與公開pending forecast，不能只把T/I塞進template。
- 已知Hold可以依語意合法交換；不得為empty Hold、clutch/spawn檢查或其他需要再一顆的操作偷偷生成第二顆。需先明確界定frontier的current/queue/reserve語意；不能正確建構完整合法單手者不得宣稱probe完成。這是implementation gate，不是跳過不利情境的理由。
- 選擇後sent/cancel/Surge等用既有transaction。cancel沒有新bonus，透過pending與結果state影響V0；先不新增一套「cancel=sent」價格。
- 原本已走過prefix的Reward只加一次。用V1取代該frontier的V0，不能加V0+V1，也不能把probe選中的行動當現在root intent。
- 尚未到known frontier的node仍用V0；不把無suffix的node與有known suffix的node混成同一種probe。
- 各probe終点仍用V0，保留既有H9、T-slot與其他weights。它不是已消除所有legacy假設：只是多做一次合法兌現再估剩餘價值。因此不能宣稱已解決長期Surge、兩步setup或所有T-slot幻覺。
- 只延續當下已公開incoming及原scenarios，不編造對手新攻擊；對手造成的新風險仍是限制。

為什麼值得：同樣井深可因下一顆可用性不同而有不同延續；相同幾何下B2B/Surge是否能合法兌現、Hold是否有解法，也會反映在交易與結果中，而非一律固定bonus。這只是機制假設，尚無真實trace證明它是目前最主要失分原因。

## 4. 成本與介面：不能偷加算力

最壞每個probe約7組合法候選的movegen/transition/evaluate；遠比一次幾何feature expensive。普通DAG本來也要花相似工作量，但此處發生在以前會停止的未知邊界。

所有probe transitions納入200000 node上限，沿用Place/Hold與scenario總預算分配，不能額外送一份免費budget。probe不遞迴呼叫自己，僅調原V0，避免爆炸。

一次probe必須完整涵蓋7種piece才可publish；剩餘budget不足就保留原V0並記錄未完成，已做工作仍計費。不得只算前幾種piece再重新正規化。快取key必含board、reserve/hold、combo/B2B、forecast clock/packet、rules、tail-model版本；無法證明相等則不用快取。

原report明示unknown_tail=finite_visible，因此實作時要新增明確的experimental value-model標記及probe accounting，不能讓有hypothetical tail的candidate冒充原finite-visible-only演算法。輸入仍僅PublicSnapshot；不能從私有引擎補任何樣本。既有accepted protocol保持原樣。

瀏覽器仍單Worker／整個Rust kernel，不新增JS↔WASM逐node crossing、thread/SAB/backend。相同node cap不等於相同wall time，必須另外測browser latency與probe造成的主搜尋深度損失。

## 5. 最小後續交付與停止條件（本次不實作、不派送）

下一個可實作交付只包含此frontier operator、必要實验标记／計數，以及offline診斷；不新增權重、不改主search selection，不做tail depth2、learned value或replay imitation。

必備檢查：

- evaluator-off完整report重現accepted；尾端7情境來源與private-future變更不影響輸出；無history inference。
- 每種hypothetical piece的合法性、Hold/spawn/clutch、clear/spin/attack/cancel與相同合成public狀態下Tetrp authority對照。unknown tail不得被當真實揭露輸出。
- horizon只前進一手，edge只計一次，終點不遞迴probe；空／死亡情境不能被平均時丟掉。death仍用accepted現行terminal處理，不新增風險權重。
- budget內完成7情境才publish；TT/caching與uncached相同值；一次失敗為technical而非換root candidate。
- 固定既有20 public snapshots先看probe coverage、值差、top1差、主搜尋深度、轉移數與wall time。這些只能證明activation與成本，不能證明決策更好。

若到不了frontier、幾乎完不成probe、budget被吃掉卻沒有可測的root影響，或不能維持正確情報／Hold語意，就在offline階段停止，不自動加budget、放寬資訊或堆新features。

只有實作與效能gate完成，才另提一個固定候選、全新seed的KO確認計畫，預先固定樣本和採用判準；不能沿用已看過勝負的這輪確認seeds。若沒有改善則拒絕此hypothesis，不自動擴成tail depth2/調7種piece機率/掃權重。

## 6. 與失敗Native的差別與不確定性

保留CC2現有搜尋與accepted基礎評分，不重新依靠單一sent減靜態安全公式；新增的是未知邊界合法延續的估值。也因此不能把成功完全歸因「新evaluator戰勝舊features」：真正改動是一層情境backup與其算力分配。

目前沒有證據保證它會贏。若使用者要的是直接清空所有features，本設計沒有做到，也不假裝做到；理由是現有證據不足以支撐一次刪光，而局部替換仍能清楚測試一個不同的價值估計方式。
