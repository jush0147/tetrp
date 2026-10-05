# 工作分配驗收：大量 frontier 空轉，但沒有提早耗盡節點搜尋

2026-10-05，run [37330860246](https://github.com/jush0147/tetrp/actions/runs/37330860246)，source `037695eaf5905266e013e5bcc731d5fcd17f3e14`，success，單job約1分38秒，ntfy成功。無arena、無production／policy／weight變更。

本機重驗4份完整report與off／accepted WASM一致；646條final paths精確重建，25個allocation所有nodes／attempts／expansions與原Statistics一致。具體數字與artifact hashes見同名JSON。

## 量到的開銷

| Snapshot | 節點 | selection嘗試 | frontier無展開 | 無展開占比 |
|---|---:|---:|---:|---:|
| leg0/request346 | 200000 | 58967 | 55448 | 94.03% |
| leg4/request419 | 200000 | 11317 | 7393 | 65.33% |
| leg12/request383 | 200000 | 25032 | 19866 | 79.36% |
| leg20/request493 | 200000 | 6882 | 1307 | 18.99% |

合計102198次selection，其中84014次（約82.21%）到finite-visible frontier後不展開；18159次完整expansion，25次因allocation最後不足而取消parent。已評但未提交的節點合計398／800000（約.05%）。沒有known_failed或selected_zero_nodes。

**所有25份allocation都用完節點預算，沒有stall_limit停止。** max連續空轉最高182，未達1024。不能把82.21%空轉叫做「82.21%節點被浪費」，也不能說因此Hold只搜到3手。它們確實執行了無新節點的selection／state advance，但沒有耗掉node額度。沒有分段wall-time profiling，不能把attempt占比直接換成可節省時間。

## 近分case的Hold工作

`leg20/request493` 的全局最佳post-Hold假想落點是Z east x3 y5。每scenario總額度10000；以下是selection經該root进入而計費的工作，不包含根展開共同成本，也不是共享DAG狀態的獨占歸因。

| scenario | root路徑計費nodes | attempts | 末端最佳鏈深度 |
|---:|---:|---:|---:|
| 0 | 1148 | 29 | 6 |
| 1 | 2573 | 85 | 6 |
| 2 | 1925 | 67 | 6 |
| 3 | 690 | 17 | 4 |
| 4 | 461 | 11 | 3 |
| 5 | 4037 | 125 | 6 |
| 6 | 4146 | 135 | 6 |
| 7 | 2713 | 78 | 6 |
| 8 | 4302 | 134 | 5 |
| 9 | 4188 | 165 | 6 |

scenario3／4主要工作去了其他root，该root计费分别仅690／461；此root在两情境都曾经产生depth5的工作，所以不能说整個root从未看到第5手。

scenario8该root拿到最多nodes（4302），且包含1968个depth6节点，其final best chain依然只到5手。这证明「最佳链较浅」不等于「整个root没搜深」或「root一定分不到预算」。一个未展开叶的当前估值仍可能高于已展开延续；这符合现有DAG机制，不能自动认定bug。

全局跨scenario平均选择的root，与各scenario当时优先搜的root并不总相同；已确认分配不均，但没有反事实证据说明改为均分、更偏向全局root或强制完成深度会提高KO率。

## 处理决定

- 没有新证据支持直接调evaluator，accepted保持。
- 能明确提出的工程候选是减少已无可展开分支的重复遍历，保持200k／known horizon／评估公式。尚未实作。跳过分支可能改变抽样分布或RNG消费，不能预先称作policy完全不变；需要区分等价加速与搜索策略改变。
- 不提高预算、不补免费延续、不强迫所有root搜6手，不因为四个state就改跨scenario配额。
- 若继续，先做一个有界的减少空转方案及同环境成本对照；wall-time未改善或变慢就拒绝，不直接进入arena。强度仍只看后续公平KO结果。
- 本次仅验收并记录，没有新run，不能宣称提速百分比或强度改善。
