# 勝負 value 與 CC2 搜尋的評分契約

本次為使用者授權的設計審查。只讀現行搜尋／forecast／snapshot／arena計分，不改bot、不訓練、不開對戰。前一個22項outcome predictor保持停止。

## 決定

若未來使用勝負value，**選擇「非終局edge reward=0，leaf輸出同一尺度的預期勝負效用」的契約**；不將勝率或logit加到現有sent／clear shaping上。

但不能只把現在的leaf board丟進前一個分類器：目前search僅推進自己與已公開pending，不模擬對手受擊／KO或未來回攻。新value至少要條件化到root public context、已模擬送出量、經過時間及可見資訊剩餘量。這是本次選定的接線規格，**不是已有合格value model，也不是已通過成本／KO的候選**。

## 1. 現行程式的帳

`bot/freestyle.rs::evaluate`產生兩部分：edge Reward（newly sent及既有shaping等）與leaf Eval。`Eval + Reward`直接相加；`dag.rs::update_child`使用`child_eval + child.reward`；known layer取排序第一個child再回傳。因此現在近似：

    路徑分數 = 累計sent及shaping + 最後一個leaf估值

這不是機率。`Eval::average`目前把缺失分支映成−1,000,000；snapshot缺Hold候選也用同一哨兵。這些數字不能沿用為勝率。

`Forecast::resolve`先cancel、累加sent，無clear時再tank已知pending。state保存sent、elapsed、combo/B2B、board與pending，但沒有對手board、受擊後狀態，也不新增對手未來攻擊。送出總量已有資料，不代表對手承受的壓力及勝率已被模擬。

## 2. 目標與正確的理論尺度

目標為相同對手／cadence／資訊條件下贏得下一個有效KO局的機率。對固定continuation policy π及對手policy μ，令：

    Vπ,μ(I) = E[最終有效勝局指標 | 資訊狀態 I]

單邊KO勝=1、負=0。**γ=1**；不另外折扣較久才KO的勝利，也不按搜尋深度除分。未知終局不是0.5、短leaf不是死亡。實際FT7在無跨局策略／狀態效應、固定對手與重置規則下，提升每有效局勝率會提升FT7勝率；本契約不宣稱涵蓋對手跨局適應。

I在精確模型中須包含对隐藏环境的条件分布。線上仍只准以此次PublicSnapshot初始化，不能回讀piece history、hidden queue／hole RNG或對手未來。模型內自己假想的action／reveal分支不等於偷讀實際未來。

simultaneous KO依arena規則不給分重打，不能偷標為敗或半勝。若建模retry episode，它是進入restart的非終局，其value取決於重開分布與續打政策；若離線只保留decisive局，模型是條件化到有效局的估計，不能聲稱自動處理action-dependent simultaneous-KO機率。目前arena whole-pair retry也不是一個普通0.5 terminal。technical failure沒有遊戲utility，不給輸贏label。

## 3. 最小介面：保留搜尋演算法，改評分語意

```text
根節點常量 c：本次 PublicSnapshot 的合法public context
節點 s：既有 compact GameState + 所在known queue layer
摘要 u：sent(s)-sent(root)、elapsed(s)-elapsed(root)、remaining-known-prefix/mask
假設 ξ：本scenario的公開pending timing／hole假設；不是實際hidden值

leaf: p = clamp(Fθ(c, project_public_model(s), u, ξ), 0, 1)
edge: reward = 0
known decision backup: max_a child_value(a)
root action ranking: sum_ξ wξ * value(action, ξ)
```

`project_public_model`必須去除synthetic bag remainder等不能當已知資訊的欄位；只輸入remaining visible prefix，不以piece count modulo推bag。hypothetical holes只能標示為scenario假設，不冒充已reveal資訊。當前root實際pose由authority allowlist驗證；後續仍用對齊movegen。

此F是**對現有模型投影的條件化近似**，不是直接宣稱精確V：目前情境沒有新增對手回攻，root context與送出量摘要也不是完整belief state。它要估計該投影對真實續局的含義，不能將「模擬期沒有新增incoming」誤當成對手真的不攻擊。

實作時需要替換evaluate回傳的所有非終局Reward來源、leaf尺度、known terminal與invalid分類，以及snapshot的負百萬哨兵；不能只將useful_attack_reward設0而保留其他shaping。已知單邊終局負可取0，**不是**看到空候選／budget不足／unsupported就一律取0；技術異常須退出診斷，未知leaf仍需估值。假想情境中自身topout取0只能標示為模型失敗邊界，因為目前並未排除對手更早KO或simultaneous KO，不能稱authority已證實的真實敗局。對手KO若模型沒算到，不得因sent大就硬判1。

選用probability而非logit做跨scenario平均；兩者對單一state排序雖單調，平均後排序不保證相同。現在equal-weight hole/timing scenarios是工程先驗，並非校準過的機率；保留它只能稱scenario-weighted估計。root同一action必須跨情境統一，不能逐scenario挑不同root再平均。

## 4. attack、cancel與剩餘資源如何計價

| 項目 | 現行transition已提供 | 新契約中的位置 |
|---|---|---|
| generated attack | 依TL規則分packet | 經cancel後的狀態效果，無獨立加分 |
| cancel | pending減少／後續tank風險變化 | 由模型狀態進F，不再加一次cancel reward |
| clear blocking／downstack | tank延期／board改變 | 由盤面、pending與時間進F |
| newly sent | sent累計，無對手反應 | 必須進入F的候選路徑摘要；不能僅以自己的board估勝率 |
| B2B／Surge／Hold／slot | state或幾何資產 | 未實現價值由F估計，無獨立未校準bonus |
| 未來對手攻擊 | 目前未模擬 | F的殘餘不確定性；不是0，也不是實際hidden future |

例：兩個分支在一組leaf特徵上同分，但A在此前送8行、B送0行。若刪除sent reward又不讓F看到這項差異，模型會強迫它們同值，進攻訊息就遺失。這是資訊投影反例，不是聲稱已找到兩個完全相同GameState的真實對戰路徑；實際GameState的forecast.sent原本就不同。

反之「0.55勝率 + 8行」沒有單位意義。將8乘某個係數只是再引進人工utility，不是從勝負目標推導出的加法。

## 5. 為何不保留現有reward再學residual

若是任意既有R，`ΣR + P(win)`優化的是混合目標。要以potential shaping維持同一目標，在γ=1時必須用：

    R'(I,a,I') = Φ(I') - Φ(I)
    leaf' = V(I_leaf) - Φ(I_leaf)
    ΣR' + leaf' = V(I_leaf) - Φ(I_root)

root項對所有action相同，故不改排序。這只是恆等式，沒有憑空得到更好的V；現行sent、wasted-T、clear shaping並未被證明共同等於這種potential差。選擇zero nonterminal reward是為了避免先增加另一個近似／係數問題，不是宣稱attack不重要。

## 6. 深度、Hold、未知future

- 3手leaf与6手leaf使用同一終局utility尺度，可比較，但不是精度相同。已知剩餘queue、時間、Hold狀態必須是F的輸入；不加depth bonus、不把短leaf判輸，也不假定所有leaf已用盡NEXT5。
- 保留目前finite-visible停止；未知tail由F的訓練分布／公開先驗承擔，不新增tail search。這是需要驗證的近似，不是未知piece真的不影響勝負。
- standalone Hold是一次公開狀態／資訊轉移，不是placement，沒有虛構24frame attack reward。authority套用後必須重新分析；不得預讀empty Hold即將reveal的那一顆。
- 現行Hold先對假想post-Hold已知prefix搜尋，再選同一跨scenario landing的分數。可繼續作近似，但不等於完整`E_reveal[max_action V]`；不能在沒有算reveal的情況下宣稱包含資訊增益。
- 未reveal scenario各自最佳continuation還可能過早使用hole/timing資訊。保持現行search即承認此近似；精確information-set backup可能需要改搜尋，超出本輪。不能因輸出改成[0,1]就把既有scenario heuristic重新命名為真實勝率。

## 7. Transposition與成本邊界

目前GameState hash含forecast.sent與elapsed；known layer區分剩餘piece進度。每個root/scenario在既有隔離搜尋context中運作。上述最低限度摘要可由現成欄位計算，不要求新增movegen、節點或opponent rollout。

**同節點key必須得到同一F輸入與值。** root常量不能跨request混用；若日後F要讀完整發送時序、burst間隔或其他path history，現行累計sent＋elapsed可能不足，必須擴key或停止使用該特徵，不能只沿某個parent寫入後讓其他parent共享。

累計sent無法完整區分「早送8行」和「晚送8行」，也無法精確知道对方已cancel多少。最小契約保留此近似；不能宣稱已完全涵蓋TL timing。更豐富的trajectory摘要會影響TT合併與成本，不在此自動批准。

保留現有node budget／selection方法不等於成本相同：新的分數會改搜尋分配，F本身也有計算成本。只有原理上不必額外search，**沒有保證wall time不增加**。沒有合格模型前不派成本run。

## 8. 訓練目標與可否證條件

前一分類器學的是`P(贏 | 實際root的22項粗特徵，既有雙方policy)`。它沒有候選模擬期間的Δsent、elapsed、remaining-known mask，也沒有對root→model leaf轉換的訓練覆蓋；因此不能直接塞進本契約。

未來資料必須明確定義continuation policy及F的輸入分布。真實已執行trajectory可用其最終有效KO作label，但只是behavior-policy value，不是最佳policy value。**同一個root的最終勝負不能貼給所有未執行sibling**；搜尋中的假想leaf也不能隨便沿用該label。若採offline counterfactual，需由authority執行指定干預、讓對手繼續依新局面決策，不能播放死replay；成本與可行性須另行設計，本次不開此工程。

接線驗收至少包括：

1. 單一leaf概率及其scenario平均可精確重建；沒有任何殘留attack／clear bonus或負百萬哨兵污染尺度。
2. terminal／invalid／unknown分離；Hold無假placement、揭露後重分析、未知piece不漏入輸入。
3. 同一key與rootcontext的輸入一致；只改模擬送出量能在feature audit中保留差異，但不強制它一定單調加分。
4. 嚴格分組的離線資料檢查只是模型診斷；最終action排序是否有用仍由公平KO證明。
5. 實際成本不退步、top1 intent／Hold／spin等authority parity無誤，才可進新KO候選。

另外修正前一實驗的解讀：early勝負接近50%在公平同seed近似對稱局面中未必不合理；整體log loss稍差也不能在邏輯上證明選招無用。之前的early／信賴區間gate是保守的實驗停止條件，不是所有value模型的必要定理。本次不因此撤回停止決定或重開該模型。

## 9. 本次交付與限制

已選定明確的評分語意與最低限度輸入契約：**zero edge reward + root／trajectory-conditioned leaf utility + scenario aggregation**。保留CC2搜尋及Tetrp authority，不把勝率與送出行數混加。

尚未完成的是合格F及其訓練資料設計；現有22項模型不能直接使用。此契約可實作介面，但目前不值得做一個只換成劣質value的bot候選。這是設計結果的邊界，不用另一輪feature／模型／arena掩蓋。

## Source核對

- `.cache/cc2-parameter-audit/src/bot/freestyle.rs:258,626–660`：evaluate、Eval／Reward與average。
- `.cache/cc2-spawn-source/src/dag.rs:258–289`，`src/dag/known.rs:85–157`：reward加總、transposition及max backup。
- `.cache/cc2-parameter-audit/src/forecast.rs:5–23,116–155`：sent／elapsed、公開pending的cancel／tank，無opponent transition。
- 同目錄 `src/analysis.rs:308,470–597`：1／10／30 scenarios、equal mean、明示future-information optimism。
- 同目錄 `src/snapshot.rs:294–375`：occupied／empty Hold已知prefix、獨立action、mean／worst排序。
- `scripts/kiwi-cc2-series-score.js`與`kiwi-residual-arena-plan.js`：正常KO、simultaneous不計分及whole-pair retry。

以上為先前已定位source及本輪再次核對；沒有新增runtime測試或聲稱搜尋是完整TL雙人模擬。

本輪補存三個source SHA256：forecast.rs `8b5b958703de2e3564e5b9e5034a1fe029d0b64f64a1d9a451d9d7d6515f8ae5`；analysis.rs `ff714d023296241d168bd5d9ce08964c340666a5cc4e5ea8303f0a234518082d`；snapshot.rs `679d7d58c5f89993ac1f251ee34e6ad4b3afd3b8d0c7996256d147a74d02cdd8`。freestyle／dag來源指紋另見 [leaf合法性重用紀錄](RESIDUAL_LEGALITY_REUSE_REVIEW_2026-10-06.md)。
