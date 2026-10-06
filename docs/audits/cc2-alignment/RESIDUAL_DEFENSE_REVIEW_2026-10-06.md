# 剩餘資源估值檢討：incoming折價是否忽略防守用途

2026-10-06，使用者授權針對已結束候選做一次設計檢討。本次只讀現有source／artifact、重跑兩個既有規則測試並保存結果；沒有修改evaluator、沒有新Actions／對戰。

## 結論

候選的`P_due/C`折減沒有區分「垃圾已ready」與「這次動作真的會讓垃圾進場」，也沒有條件化到資源本身的防守用途。這是已確認的**模型省略**，不是Tetrp／search transition的規則bug。

但是現有取樣不能證明它造成104–96、不能證明某個root選錯，也不足以直接支持第二個候選。此次沒有選定新的評分公式，不把「找到近似限制」偷換成「找到改善勝率的方法」。

## 1．規則與現有搜尋已做的事

核對`src/attack.js`的`fight/resolveAttack`、`src/engine.js`的tank-decision，以及accepted `data.rs::advance`、`forecast.rs::resolve`、`bot/freestyle.rs::evaluate`。

- 普通TL combo blocking下，合法消行可阻擋這次垃圾進場，**零攻擊Single也可以**。這是延後进場，不是把pending清掉或無限免疫。
- 生成攻擊先經cancel；普通opener防禦、Surge／ordinary／AC分packet等語意不能只以`min(raw_attack,incoming)`取代。
- accepted search在已展開的transition先取消公開pending，沒有消行才嘗試tank。clear後remaining下降會影響H1，真實board／H9也跟著後續交易演進。cancel reward=0不等於cancel沒有影響。
- 搜到這個防守行動時，它已由child transition及backprop計價；不能額外把同一個cancel再當asset加一次分。

本機執行既有`test/attack.test.js`中`zero-attack single blocks tank; no-clear tanks cap eight`與`opener budget is defense only and includes inactive packets`，2／2通過。不新增一套規則測試或gameplay simulator。

## 2．公式的精確限制

既有候選：

    g = 1 / [d × (1 + P_due / C)]
    leaf = S(real state) + G(real board) + g × A(template)

即使d=1、模板會消行，P_due也包含這次lock到期的packet；公式因而降低A。若該clear實際合法且可執行，這個packet不一定會在該lock進場，還可能被cancel。可確認的是公式沒有表達這個條件，不是「due不該影響任何資源」：尚未能用的T、等待中會死、模板不可達等風險仍真實存在。

不能直接改成`d=1就不折價`，因為d只證明piece供給，不證明合法可達、spin provenance、spawn存活或slot能保留。這樣改只是換另一個近似，且會是在已結束候選上補救，本次不執行。

## 3．現有真實witness支持到哪裡

使用run37444591656已有20snapshot × 最多24個正資產leaf witness，共480筆。取樣偏向最先遇到的正資產，不是隨機樣本、不是200局的全部leaf，不能估計整體發生率。

- 213筆d=1；其中5筆P_due>0，全來自leg4/request167。
- 這5筆中3筆模板不消行；另外2筆（index3、10）模板消1行，d=1、due=2、height=20、C=1，A=1.5、g約1/3，資產項因此是0.5。
- 此2筆未證明模板path合法或spin成立，也未保存完整leaf combo／B2B／forecast context、所屬root與最終backprop貢獻。不能據此算精確cancel或稱其為「被壓掉的最佳防守」。
- 另5筆是d>1、due>0且模板消行，其中只有1筆兩行模板：d=11、due=2、A約18.8、g約.0303。它依賴未知等待，不能拿來代表「眼前可立即TSD」。
- 現有樣本沒有d=1、due>0的兩行模板。不能宣稱已在這批trace找到立即TSD被incoming折價的實證。

原資料索引及相關witness保存在同名JSON。leg4/request167也是離線top1改變的state，但沒有root attribution，**同一snapshot發生兩件事不構成因果證據**。先前已知最終路徑診斷不在本次重跑。

## 4．更直接的估值需要什麼

方向上更直接的是「資源被合法使用之後留下的pending、board與後續能力」，而不是使用前的due總量。不過分三種情況：

| 情況 | 已有資料／成本 | 本次判斷 |
|---|---|---|
| 已展開合法child | 真實對齊transition及backprop已存在 | 重用可以查帳，但不能再加一次收益；目前沒有證據支持改回傳方式 |
| 未展開leaf上的固定模板 | 有cell幾何，沒有path/spin/安全等待證明 | 直接算生成攻擊或cancel會把假設當合法能力；不能稱精確資源價格 |
| 未知piece／等待後續 | 只有公開資訊及近似prior | 更可靠驗證需額外動作枚舉／transition／情境延續，屬已限制的額外搜尋方向 |

純rule arithmetic本身未必貴，但它需要可信的輸入：clear/spin是否合法、combo/B2B在使用時為何、packet在等待時是否已消耗。缺的是使用条件，並非單純少算一個attack數字。直接接純attack函式不會自動解決。

可以繼續寫更便宜的static proxy，但這次資料沒有給出足以推薦的替代proxy，也不能保證它不會重演另一種「看起來合理」的折價。這不是證明低成本方案不可能，而是目前沒有跨過的設計缺口。

## 5．目前決定

保留accepted；關閉的候選保持關閉。不恢復調weight、不移除一項折減試運氣、不加cancel bonus、不做新的tail／效能工程，也不再派一輪相同診斷。

本次交付完成：確認模型盲點、列出真實樣本與其證據邊界、指出舊搜尋已處理的防守，以及更直接估值所需的缺失條件。**尚無值得實作的第二個低成本候選。**後續若要繼續設計，必須明確解決「不用額外搜尋，如何讓資源可用性比現有模板更可信」，不能僅換名／換數字宣稱已完成。
