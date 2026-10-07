# 連續六手樣本：真實續局與搜尋leaf的資料落差

使用者授權的小型資料檢查已完成。使用既有run37452163955 block0／leg0，固定piece count 0、16、64、128，各取雙方，**8段、每段6次placement／144 virtual frames，共48 locks**。不是依勝負或症狀挑選；只是一局內的資料可用性檢查，不能估計整體分布。

## 結論

公開起點、實際連續動作、送出／抵銷／進場量、揭露時序與最終KO label都能取得，且可逐欄核對。**但這8段不能直接當成新評分契約的「搜尋模擬leaf→勝負」訓練列。** 本次trainingRowsCreated=0；沒有訓練、沒有新arena、沒有改bot。

這不表示真實對戰trajectory不能用於學習。它們是合法的behavior-policy資料；後續玩家看到reveal是正常玩法。問題是不能把「政策得到新資訊後重新決策的真實續局」誤稱為「起點固定資訊下的搜尋路徑」。

## 可核對樣本

seat只作audit metadata，不是模型feature。incoming欄為新packet數量，非垃圾行數；左側在六手期間、右側在終點下一次決策邊界。

| 起始piece count／seat | generated | cancelled | newly sent | tanked | Hold次數 | 新incoming packet：中途／終點 | 放到起點未知piece |
|---|---:|---:|---:|---:|---:|---:|---:|
| 0／0 | 0 | 0 | 0 | 0 | 0 | 0／1 | 0 |
| 0／1 | 4 | 0 | 4 | 0 | 1 | 0／0 | 1 |
| 16／0 | 5 | 0 | 5 | 5 | 1 | 1／0 | 0 |
| 16／1 | 5 | 0 | 5 | 5 | 2 | 1／0 | 0 |
| 64／0 | 12 | 0 | 12 | 0 | 2 | 0／0 | 0 |
| 64／1 | 9 | 4 | 5 | 3 | 1 | 4／1 | 0 |
| 128／0 | 0 | 0 | 0 | 3 | 2 | 3／0 | 0 |
| 128／1 | 6 | 0 | 6 | 0 | 3 | 0／0 | 0 |

## 1. 已知piece與新reveals不能只比字母

用identity token標記起點current=C0、NEXT=N1…N5、occupied Hold=H0，後續首次揭露=U1、U2…。同型方塊不能因字母相同就算起點已知。逐request驗證token序列和actual snapshot完全相符。

- 7段揭露6顆，empty-Hold那段揭露7顆；新piece不一定已被放置，也會出現在NEXT中。
- 每段都有5–7筆後續request已看到起點未知的preview。這只證明政策有機會使用該資訊，**未證明某一手實際因該preview改變**；沒有做counterfactual重新分析。
- 0／seat1的empty Hold消耗額外queue位置，第6個lock已使用起點未知piece。這也符合既有empty-Hold search只保留較短known prefix的限制。
- 在輸出中，`endpointSupplyMaskedToRoot`把U token的piece設null並保留known mask；但只mask endpoint的preview，無法消除先前actions依賴新reveal的可能性。

這種token audit不做bag remainder或piece-count modulo推斷；token僅描述「這個piece是否已在該起點公開」。

## 2. 對手仍在動，真實endpoint不是目前forecast的leaf

4／8段在六手期間有新packet admitted，另有片段只在終點邊界新增packet。現行CC2 forecast只處理起點已公開的pending及其假想activation／hole，不會生成這些後續對手攻擊。

例如64／seat1的六手generated=9、cancelled=4、sent=5、tanked=3，且有4個新packet中途admitted、1個在終點邊界。不能把這個實際endpoint貼給「只推進起始pending」的model leaf，亦不能從這幾個總數反推出每個新packet在各手造成的全部影響。

`receiveEvents.offeredAmount`是對手送來的原始packet amount；authority可能先依outgoing ledger交叉抵銷，所以不能把它當作admitted垃圾量。本輪只可靠報告cid是否非null（有新packet），不虛構精確admitted量。

## 3. endpoint時間邊界須一致

選定endpoint為第6次lock後、下一次決策前的PublicSnapshot，frame差144。arena先delivery再產生request；anchor則在前一frame循環結束保存，可能尚未delivery。

因此incoming區分during-prefix與endpoint-boundary。0／seat0的新packet只在終點frame144進來，不能說它影響了先前6次lock。generated／cancelled／sent／tanked以anchor累計差核對，sent另與PublicSnapshot.cumulativeSent差值一致；這四種交易統計不從privatefuture推算。

## 4. 真正缺少的欄位

| 需求 | 現有紀錄 | 能否直接使用 |
|---|---|---|
| root PublicSnapshot | reports及decision相等 | 可以，線上合法輸入 |
| 實際後續PublicSnapshots及動作 | 有 | 可以作behavior-policy軌跡，不能冒稱起點固定計畫 |
| prefix sent／elapsed | 有，144frames且sent雙重核對 | 可以作實際軌跡摘要；尚非搜尋projection摘要 |
| root當時搜尋的scenario leaf與known mask | 一般reports沒有完整best-chain／leaf | 缺少；root ranked score不能還原它 |
| 該模擬leaf對真實續局勝負的label | 沒有直接對應 | 不能把root最後勝負複製給所有未執行sibling |
| 最終有效KO | 有，來源auditGame通過 | 僅是實際雙方policy下的outcome |

只新增leaf trace也不能自動補出反事實label。若要往該契約訓練，還需另行定義model projection與真實trajectory的對應／continuation政策，或新的offline干預資料；本次未實作或授權派送這些工作。

## 驗證與交付

`node scripts/kiwi-value-segment-audit.js`可重現。核對整局reports與decision events的snapshot／action逐筆一致及request數；48個lock與原placement certificate的piece／x／y／rotation／cells／spin／clear／frame紀錄一致。這是紀錄parity核對，沒有重新執行48次authority。

每段current／Hold／NEXT token逐request轉移一致，Hold不增加placement或frame，六手總frame=144。最初腳本把initial事件的frame當成頂層欄位，觸發assert；已改從initial.state.frame讀取後全數通過，不涉及資料或gameplay修正。

[樣本JSON](VALUE_SEGMENT_AUDIT_2026-10-07.json)保存8個完整root snapshots、實際endpoint snapshots、逐手audit、root-known mask、receive時序、outcome與來源SHA256。`offlineObservedContinuation`明確標為事後證據，不是線上feature payload；沒有輸出private checkpoint、hidden queue或RNG。原始anchor只讀累計交易量供離線查帳。

**本輪沒有產出可投入訓練的新資料集，也沒有用此結果判斷bot強弱。** 完成的是資料可取得性及不等價原因的核對。
