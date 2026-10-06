# 同盤面合法落點能否重用於剩餘資源估值

2026-10-06。使用者授權檢查既有 movegen／DAG 資料流；不改 evaluator、不開 Actions／arena。承接 [方向](RESIDUAL_VALUE_DIRECTION_2026-10-05.md)及[防守估值檢討](RESIDUAL_DEFENSE_REVIEW_2026-10-06.md)。

## 判定

**現有資料流不能直接提供未展開 leaf 的下一手合法落點證據。這次不選定新候選。**

同狀態已展開的 transposition 確實能重用，但現行 DAG 已使用該節點回傳值；這不是一份尚未利用的免費 residual 資訊。這個結論不等於證明所有低成本 evaluator 不可能，也不等於 bot 已達強度上限。

## 實際資料流

```text
select 尚未展開狀態 S
  → movegen(S.board, 可用 piece, clutch 條件)
  → 對每個合法 action a：複製 S，advance(a) 得到 S'
      （放置、消行、B2B/combo、attack/cancel、可能垃圾進場）
  → evaluate(S', 本次 PlacementInfo)
  → 收齊 ChildData 後 node.expand
      → 下一層 transposition get_or_insert(S')
      → 若 S' 已存在，使用既有 node.eval
      → edge.cached_eval = child.eval + edge.reward
      → 父節點取最佳值並 backprop
```

`bot/freestyle.rs:70–154` 的 moves 是 S 的局部變數；evaluate 收到的是 advance 後的 S'。本次 PlacementInfo 只證明 S→S' 這一手，不是 S' 的未來動作。消行、放置遮擋、垃圾上升、Hold／combo 變化都可能改變可達集合；不能把父盤面清單套在子盤面。

預算不足時取消整個尚未完成的 expansion；不能把未發布的局部清單冒充完整能力。有限可見搜尋不展開未知層（Dag 的 LayerKind::Speculated 在 speculate=false 時 select 回 Failed），故真正可見邊界也不會自然產生下一顆未知 piece 的落點集合。

## 逐一檢查重用來源

| 來源 | 真正已有的資料 | 對未展開 leaf 的判定 |
|---|---|---|
| 父節點 movegen | 父 board 上指定 piece 的 reachable Placement＋spin＋softdrop distance | board／piece 條件不符，不能直接使用 |
| S' 已被其他路徑展開 | 同層 StateMap 的 node.eval／children | create_node 已回傳既有 eval；不是漏用。再加已實現 attack/cancel 會重複計價 |
| S' 尚未展開 | 初始 heuristic eval，children=None | 尚無下一手清單；需要展開才有 |
| 其他層或其他狀態恰巧同 board | 可能有可借用的幾何結果 | 現行無完整 board-keyed 落點快取；完整價值還需 queue/Hold/combo/rules/forecast。不能只以 occupied cells 視為等價 state |
| AIR_PREFIXES | 按 (piece, cutoff) 快取的空中移動前綴 | 只到盤面上方的安全邊界，尚需 board-specific 遍歷；不是 T-slot／spin landing 證書 |
| root authority allowlist | 當前 active pose 的完整合法落點 | 只證明 request root；不能跨到任何後續 leaf |

同 board 的幾何 cache 原理上可另建，但須精確匹配 piece、spawn／active pose、clutch 與相應規則；缺 cache entry 表示 unknown，不能解讀為 impossible。新增保留／查詢需要記憶體及時間，命中率也未量得。因此本次不把「可以另外做 cache」當作已符合不增加分析成本的新 evaluator，更不另起效能支線。

## spin 證據的邊界

movegen 遍歷中保留不同 spin 狀態，輸出 Placement 含 location、spin；DAG Child 保留 mv、reward、cached_eval。它沒有保留完整按鍵／kick 路徑。可將輸出視為對齊 movegen 在該起始條件下的 reachability 結果，不能宣稱它已是 Tetrp authority placement certificate，更不能證明 24 frames 的 physical input 可達性。

即使另存完整路徑，路徑仍屬原 board；它不會自動證明 advance 後的新盤面。這與本次 arena root commit correctness 是兩個問題，本次沒有發現或宣稱新的 authority bug。

## 工程決定與停止條件

不實作這個「直接重用合法落點來取代 leaf 模板」提案：所需證據在未展開 leaf 尚未產生；若已產生且同一 DAG 狀態，延續價值已重用。延後評分等到 leaf 展開，就是現有 backup 的工作；為了取得證據強迫每個 leaf 展開，則是追加搜尋。

這次資料流檢查至此完成，不再為同一問題派 trace、cache 命中率或 KO 任務。低成本替代 residual 路線目前沒有可執行的第二候選；accepted 保留，104–96 候選維持不採用。若要換路線，需明說變更理由，不能自動回調權重或重啟 tail。

## 核對來源與限制

只做 source-level review，未編譯／測速／新增強度證據。核對 preflight workflow 的 source pin `2e243242b674d57491f99b445f75e35fc48a0e26`、landing-final.patch、native runner prepare 及 residual prepare；runner 只加 stdio binary，residual prepare 不改 DAG。

- `.cache/cc2-parameter-audit/src/bot/freestyle.rs`：SHA256 `9fe27a686c21515eb729af2ec73c4b99cd0ad6201b783fd35319a93c265f03d1`，與 residual prepare 的來源 hash guard 相符。
- 同目錄 `src/data.rs:313–358`：advance；`src/dag/known.rs:19–24,85–157,204–241`：node、transposition create、expand、backprop。known.rs SHA256 `973f2eae276a1822e3c3c50af0ea0d16287df9a5506797274cdf5181ef4d923a`。
- `.cache/cc2-spawn-source/src/dag.rs:174–239,353–367`：selection／publication／finite boundary；SHA256 `aed081fd3729c4c397ac022166117fec905484232dba6f7f32ec833e4a01c91e`。
- 同目錄 `src/map.rs`：按 GameState hash 分層索引，非 board-only move cache；SHA256 `148cf747851bdddff3bc72b02527058c4b51caf7b1d8ddaf5bbef57420da70ad`。不把 hash 索引稱為形式上的無碰撞證明。
- `.cache/residual-value-37444591656/candidate.patch`：完整實驗 patch，沒有 DAG／map 改動，含最終 dense movegen、逐格下降及 AIR_PREFIXES；SHA256 `6fd5eac2267e169a9ec675019341499185eb190352ea5d13de30d4c7dabd8e85`。較早 spawn-source 的 movegen 並非最終版本，不能用其舊 fast-mode 判定現行資料流。
