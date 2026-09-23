# First garbage reveal + one placement: bounded offline audit

2026-09-23。輸入是已審查 0–7 對局的 G3 F1032 / F1056 PublicSnapshot。
Production policy、weights、engine、arena 全未修改；沒有新增對戰或 Actions run。

## 結論

**找到具體 cutoff failure，但沒有找到支持直接加 B2B residual bonus 的證據。**

F1032 的 Hold 分支在第一次吃垃圾時停止，漏看下一顆已知 T 可以普通 Double、送 1 行。
只把該 frontier 往後延伸一手、沿用原 evaluator，這條 frozen branch 就超過原 Mini branch。
F1056 則不變：延伸一手後，所有枚舉的候選都沒有正攻擊，保留 B2B 分支仍比普通消行差。

這是 bounded model 的分數與可實現攻擊證據，**不是 KO 勝率證據**，也不是完整重搜後的 production top-1。
兩個相依的真實 states 不能代表所有敗局。

## 方法與資訊邊界

- 固定原 search 保存的每個 root 最佳 continuation；F1032 另外加入原 Mini root 下三條保 B2B continuation。
  共 38+3、36 條 frozen prefixes。没有重新優化 reveal 之前的路徑或復活之前被 prune 的 prefixes。
- 使用原本十種等權 hole scenarios，activation timing 不變。兩個 snapshots 都只有一包一行、activation frame 已知。
- 原 prefix 必須在第一次 reveal 停止；baseline 分數逐 scenario 與已存 audit 相符。
- 原本 terminal leaf 改成：垃圾 reveal 後，枚舉 current 與合法 Hold 的所有 ordinary-regime movegen 落點，再執行**恰好一個 placement**。
  不使用 beam／TT 剪枝。每次 movegen 必須完整結束，否則 diagnostic 直接失敗。
- Root／pre-reveal action 固定；reveal 後的選擇只接受那個 revealed compact state，函式不接收 scenario/hole label。
- 不補新的 NEXT、不讀 bag/hole RNG、不使用真實後續落子／incoming。只消耗原 snapshot 已知的 current、Hold 與五顆 NEXT。
- 一行垃圾在 frontier 已完全進板；延伸前強制 pending 為空，且下一顆仍已知。因此此實驗**沒有第二次未知洞偷看問題**，但不能泛化為多 packet／未知 activation 的搜尋演算法。
- 評分仍是 cumulative newly sent − L − U − H；四個 weights 皆為 1。
- 每個獨特 revealed state 所選的最佳延伸，用 Tetrp placement authority 驗證 path/provenance，再在 frame+23/subframe .5 commit。
  比較 occupied board、garbage markers、spin/cells/clear/lock、combo、B2B、generated/cancelled/sent、death。
  F1032 410 次、F1056 350 次，**760 次全部通過**。這個計數是延伸 placement 檢查，不是聲稱重新驗證整場 Hold／原始對局。

所有 successors 的完整資料可由腳本重現至 `.cache/kiwi-frontier-probe/*-full.json`。
本資料夾 JSON 保存 snapshots、全部 frozen branches、逐 hole 最佳動作及 authority 結果、枚舉數量、最大可能 attack 與分數。
沒有引用 real-game future outcomes 作為 probe 輸入；測試將原 audit 的 observed/originalTop1 改成讀取即拋錯，probe 仍通過。

## F1032

|固定 prefix|原 leaf score|多一手後|延伸 G/C/S|備註|
|---|---:|---:|---|---|
|原 rank 0：J Mini1 → T normal1 → Z0 tank|−32.80|−33.20|0/0/0|延伸 S0；B 已斷|
|原 rank 1：Hold O → O0 tank|−35.45|**−30.05**|**1/0/1**|延伸 T normal Double；B 0→0|
|同 Mini root：J Mini1 → Hold O0 tank，node 89|−33.40|−35.25|0/0/0|保持 B=1|
|同 Mini root：J Mini1 → Hold O0 tank，node 90|−33.40|−34.80|0/0/0|保持 B=1|
|同 Mini root：J Mini1 → T0 tank，node 76|−34.40|−36.25|0/0/0|保持 B=1|

Hold branch 的延伸 T 落於 `(8,27,r1)`，spin=`none`、消 2 行（非 garbage rows）、generated=1、cancelled=0、sent=1。
它的十個 hole scenarios 都選這一手，並得到相同分數，不是靠少數有利 hole 或 hole-dependent action 才成立。

原 Hold leaf：L=12.2、U=12、H=11.25，score −35.45。
T Double 後：L=10.6、U=12、H=8.45，加 sent=1，score −30.05。
分數提升 **5.40 = sent 1 + L 改善 1.60 + H 改善 2.80**。

原 Mini branch 延伸後為 L=11.4、U=12、H=9.8、sent=0，score −33.20。
Hold branch 高出 3.15，並沒有任何 Mini penalty／TSD bonus／B2B bonus。
F1032 全部 branch×hole 延伸中，只有上述 Hold branch 的十種情境存在正攻擊；不是把其他已搜到的 TSD 壓低分。

**注意：贏過 Mini 的是直接 Hold branch，不是「先 Mini 再保 B2B」的 branch。**
這裡找到的是普通 Double 的具體延續價值，不能包裝成 B2B asset 假說獲證實。

## F1056

|固定 prefix|原 leaf score|多一手後|延伸 G/C/S|終點 raw B|
|---|---:|---:|---|---:|
|原 rank 0：T normal1 → Z0 tank|−32.80|**−33.20**|0/0/0|0|
|原 rank 1：Hold O → O0 tank|−33.40|−35.25|0/0/0|1|

普通消行路線延伸 S0：L=11.4、U=12、H=9.8。
保 B2B 的 Hold 路線延伸 Z0：L=12、U=12、H=11.25。
兩條路線差 **2.05 = L .60 + H 1.45**，由原來 .60 擴大。

全部 36 個 frozen root branches、十種 hole scenario 中，**所有枚舉的延伸 placements generated 都是 0**。
不是 evaluator 看得到這一步能攻擊卻不選，而是在這個有限範圍內根本沒有正攻擊。
不能據此聲稱更深的 B2B continuation 不存在；但現有證據不支持為了讓保 B2B 分支勝出就添加 bonus。

## 尚未回答的問題

1. **取消垃圾的 dynamic defensive value**：這個 probe 的延伸前 pending 已空，也沒有憑空添加未來 incoming，故 cancelled 必定為零。
   因此它能證明 cutoff 漏看攻擊，不能證明這些攻擊會在真實對局 cancel 多少未來垃圾或提高多少存活率。
2. **不同終止時間**：每條 prefix 都多一手，但 F1032 Mini 總 depth 4、Hold 總 depth 2；F1056 分別 3、2。
   此處隔離的是「現有 frontier leaf 改成一手可實現 continuation value」，並沒有等化總 horizon／時間。
   不能把這個排名當成同時間長期 value 的公平估計。
3. **Search coverage**：reveal 後枚舉不剪枝，但之前仍沿用被原 beam 選出的 prefixes；且現有 ordinary-regime movegen 不枚舉全部高 rotation-count provenance。
4. **實際 progressive reanalysis**：真實 Hold／下一手 snapshot 會 reveal 新 preview。Probe 不補未知 pieces，僅比較原有資訊支持的 continuation，不宣稱模擬了完整線上 policy。

## 下一個最小工程實驗

值得測的是一個獨立、預設關閉的 **drained-garbage frontier 一手延伸** candidate，而不是 B2B bonus：

- 僅在第一次垃圾 reveal、pending 已完全耗盡、current／所需下一顆仍已知的情況啟用。
- 同 scenario probabilities、相同 evaluator／weights／既有主 search budget；將額外 rollout 的工作量單獨記錄並明確限定。
- 對不可分辨的 revealed states 共用 action；多 packet／未知 activation／未知 next 保持原 cutoff。
- 不發布只算完部分 candidates 的延伸排名；預算不足必須回到完整一致的原比較層，不能只加分給先枚舉的 root。
- 記錄實際使用次數、改變 root 次數、額外 latency，先通過信息邊界與 authority parity，再以 KO arena 驗證。

這是下一個可檢驗 hypothesis，不是本次已完成的 production 改動。本次没有實作該 candidate、没有調參、没有啟動新 arena。

## 重現

```sh
node scripts/kiwi-frontier-probe.js
node --test test/kiwi-frontier-probe.test.js
```

兩個 regression tests 通過；重新驗證 baseline parity、公開資訊邊界、最優分數確實來自完整延伸枚舉、authority parity，以及兩個不同的 hypothesis 結果。
