# T-slot 第一個局部候選：可見 T 資源計數

2026-09-29。狀態：**候選規格與離線影響盤點完成；尚未修改、建置或採用 bot 候選。** 本文件不是強度結果或 production promotion。

## 固定一個假設

將 snapshot finite-visible evaluator 的 cutout 次數，從 synthetic bag 公式換成：

`remaining_known_queue_T_after_transition + (post_transition_reserve == T)`。

使用每個 search node 所在 layer 的剩餘已知序列，不是整個 root NEXT 重複計數。當前剛放下的方塊已消耗，不能再算一次。occupied Hold 的 reserve 是 Hold；empty Hold 的 reserve 是正規化 current，兩者都是已知未放下方塊，但可用性不同，不能一律稱作 Hold。

只改資源計數。T-slot 模板、tslot array、假想消行後評基礎盤面、H1/H9 的真實 board、所有 reward、其他權重、搜尋演算法與 node budget 都固定。預設入口與 accepted artifact 不替換。

## 哪些是語意修正、哪些仍是策略假設

- 正確性要求：計數只能來自 public remaining pieces，不由 synthetic bag / pieces modulo / history 推導；Hold 與 queue 消耗不能算錯。
- **策略假設 A：未知尾端的 T 不先提供 cutout 名額。** 不代表未知 T 價值真是零；此候選會弱化遠期 T-slot 潛力，有變弱的風險。
- **策略假設 B：已知有 T，仍沿用原模板與假想消行近似。** 尚未證明在 intermediate placements / garbage / timing 下能兌現。這次不擴張成 proof-based multi-piece evaluator。
- 因此不能把這個候選直接稱為「修好後必須採用」。它只是最小可辨識的資源假設比較，並未徹底解決所有 offensive residual value。

不另加未知 T bonus，不發明折扣率，不同時把 base board 改成永遠真實 board，避免一次改三種機制後無法判讀。

## 為何不是只刪 bag.len<=3

729 個保留節點：候選名額有 632 個會降低、34 個會提高、63 個相同。synthetic bag 不僅可能高估，也可能在有多顆已知 T 時低估。只刪最後一項仍留著 `bag.contains(T)` 的相同資料語意問題。

这些是 quota-selected diagnostic witnesses，不是獨立局面或實戰比例。降低／提高名額不等於分數一定同向變動，因為之後幾何模板與 well/transitions 也可能改變。

`scripts/kiwi-tslot-resource-proposal.js` 記錄逐筆比較，對「候選 T 數為零」才計算由既有 trace 可確定的局部差值；非零新計數不假裝已有重算結果，特別是新計數大於舊計數的 34 筆可能找到從未記錄的額外模板。

## 實作與 gate 規格

1. 獨立 build-time candidate，baseline/off 必須完整 report 精確相同。不能悄悄改 production profile。
2. 从 DAG 已知 layer 取得 **本次 transition 後**的 suffix 計數，遇到 speculative/unknown layer 立即停止。每層可預先計數，不能每 node 掃 private Engine queue。若 generic SevenBag API 存在，保持其原路徑，候選僅限 snapshot finite-visible。
3. DAG transposition 中相同 state/known-depth 必須看到相同 suffix；不要用 mutable global 計數影響 evaluator。實作時驗證 layer 與 queue lineage，不能靠外部 observer side channel 傳 policy 資料。
4. 必測：沒有 T、有 Hold T、remaining 有兩顆 T、empty Hold 正規化、剛放 T 不再算、Hold swap、公開 prefix 耗盡。不可以放寬 malformed/hidden-field rejection。
5. 候選不要求和 baseline 決策相同；要求 default-off 與 accepted report 相同，且候選 top-1 合法、node cap／snapshot boundary 不变。
6. 先在小 corpus 驗證 resource invariants、分項差異與耗時。此階段不能宣稱強度提升。完整機制有效性仍需後續獨立公平 KO arena，目前未啟動。

## 接續工作

下一個具體工程項目是依上述規格準備隔離候選與 regression gate，**不再補同一現象的 observer，不開始權重 tuning**。沒有證據前保留 accepted baseline；此 T-slot 項完成局部候選驗證後，回到其餘現有機制審查表，不把所有工作縮成只研究 T-spin。
