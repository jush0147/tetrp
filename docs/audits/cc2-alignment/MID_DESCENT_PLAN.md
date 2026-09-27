# 中途下降展開：單項 geometry 候選

原因假設：CC2的低盤面full-drop終點seed與只展開完整下降edge，會漏掉下降途中先橫移的合法落點。此次候選僅改此展開方式：停用fast-mode seed／above-stack剪枝，從真正spawn開始，加入下降1格edge；保留原full-drop edge、rotation/spin分類、soft-drop累計及DAG/evaluator。這是易驗證的correctness候選，未宣稱效能可接受或應直接接production。

配對workflow在同runner先跑pinned baseline，再套`mid-descent.patch`重編candidate；保存combined diff與patch hash。Authority cases共用同一份，避免fixture差異。

## 驗收

- 原27例保留：baseline應重現唯一`overhang/j/false`缺口，candidate必須補回；其他26例comparisons完全不變。
- 新增12例：原結構／鏡像 × 上移0／2／8格 × J／L。上移後下方留空，是測試結構變化，不能假設落點數保持相同。lift0含刻意重複控制，不算獨立strength樣本。
- 39例candidate的cells+spin集合必須全部等於authority，不能有新cc2-only或authority-only。
- 每例7批×25次同kernel呼叫，記錄native wall-clock中位數／ratio；含repeatability assertion。兩arm順序執行，數據只供成本診斷，非browser效能驗收。
- 額外記錄所有原有placement的soft-drop cost變化。取消fast seed可能改變cost，即使cells集合相同也不能當成policy不變；本輪不調weights，接回DAG前必須處理此相容性影響。

本機39例authority列舉／certificate全部完成、3項targeted tests通過、patch apply-check通過。Rust candidate尚待Actions；完成或失敗由ntfy通知，不盯場。

Production未替換，不開FT7。若新fixture暴露另一類spin／geometry差異，先看witness，不能为了過gate把多種規則修正混入本候選。
