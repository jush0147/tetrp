# T-slot 第一個局部候選：可見 T 資源計數

2026-09-29。狀態：**隔離候選與診斷 gate 已實作；本機 source-transform／八個 accepted WASM fixture 驗證通過，候選 Rust 編譯與 runtime gate 待 CI。** 未採用候選；本文件不是強度結果或 production promotion。

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

隔離候選由 `scripts/kiwi-tslot-candidate-prepare.js` 安裝，僅在 `--cfg snapshot_visible_t` 且 finite-visible snapshot 分支開啟。從當前 DAG layer 的下一層開始遍歷，遇 unknown 停止；每次 expansion 計算一次，最多目前的公開 horizon，不在每個 child 重掃。無 mutable global policy 資源計數。

`kiwi-tslot-resource-audit.yml` 執行單一 30 分鐘上限診斷 job：四個既有真實 snapshot 加四個明確標記的 synthetic Hold/T 邊界局面，全部維持 200k shared node cap。default-off 與 accepted WASM 完整 report 精確相同；candidate observer-on/off 完整 report 精確相同。診斷 observer 以獨立公開 queue context 對每次非 terminal evaluate 斷言資源計數，保留樣本再核對 path 消耗與完整方塊 multiset 守恆。候選 top-1 必須通過既有 authority 幾何／spin 驗證，禁止 fallback。Rust 單元測試覆蓋資源計數與消耗，並跑既有 snapshot contract tests。

記錄 native 單次耗時只供診斷，不當作 browser performance benchmark；尚未建立新 WASM/browser candidate。這輪不是 authority transaction arena，不能由 top-1 geometry 檢查宣稱完整 lock-frame／garbage parity。

CI 完成後先讀 gate 與候選差異，**不開始權重 tuning 或自動開 arena**。沒有證據前保留 accepted baseline；此 T-slot 項完成局部候選驗證後，回到其餘現有機制審查表，不把所有工作縮成只研究 T-spin。
