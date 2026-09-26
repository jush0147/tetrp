# Kiwi：回到 CC2 分支做 Tetrp 規則耦合審查

更新：2026-09-26。**上下文切換後先讀本檔，再讀指定原始碼；不要重新要求使用者選方向。**

續篇：已完成第一輪[搜尋規則耦合審查](audits/cc2-alignment/README.md)，含完整資料流、保留／替換範圍、三個已執行 source-expression witnesses，以及下一步真正 Rust differential harness。Production 未改，未開對戰；完整 Rust parity 尚未執行。以下「尚未完成審查」為建立交接時的歷史狀態，接續以續篇為準。

後續已建立[真正 Rust transition 診斷入口](audits/cc2-alignment/TRANSITION_HARNESS.md)：本機65個authority fixtures、9項targeted checks通過，Rust編譯／執行交新增Actions workflow。查最新 `CC2 Tetrp transition diagnostic` run與artifact；不要將Actions success等同模型parity。此輪只查transaction，Hold／movegen／spawn仍未認證。

## 固定目標與目前決定

目標仍是做出能在公平 TL S2 KO arena 贏過 Legacy、且能在 Tetrp 純前端運行的 Kiwi。停止的是目前 Native v0 beam 的局部救援與全層 lookahead 候選，不是放棄目標。

使用者提供兩個 upstream branches，希望回頭檢查當初為何未完全對齊。現在選定的下一步是：**以現行 kiwi-v1 為起點，審查 CC2 搜尋內部與 Tetrp authority 的規則耦合；tetrp-authority 作為歷史實作及測試來源。** 不直接合併 branches，不退回舊 adapter，不先調 evaluator，也不現在另造搜尋器。

使用者對反覆提出又撤回方向已非常不滿。不要把猜測講成已知根因；不要被追問後沒有新證據就換方向；不要把性能／heuristic score 改善宣稱為勝率改善。

目前只完成初步 branch/source 對照，**尚未完成可移植性審查，尚未承諾或實作規則核心移植**。這一輪交付應是有具體函式與差異案例支撐的耦合表、保留／替換範圍及最小可驗證方案。

## 不可退讓的邊界

- Tetrp Engine 是唯一 gameplay authority。外層 arena 正確不等於搜尋腦內的 transition 正確。
- Bot 只接 PublicSnapshot：current、exactly NEXT 5、Hold/availability、board、公開 counters/rules/timing/pending。
- 不讀原 replay future、private checkpoint、bag/hole RNG、opponent future；不使用 piece history 或 piece-count modulo 推 bag。舊 branch 文件若允許歷史 bag inference，已被現在要求取代。
- 未知 future 用明確假設或停止；不能把真實 hidden future 或假設 scenario 的未 reveal 資訊偷交給 policy。
- 固定 cadence 的 strength arena 使用 authority-validated direct placement commit，保留 spin/path provenance，不透過 keyboard transport 重新選落點。Top-1 失敗是 technical failure，禁止 silent fallback。
- Hold 為 standalone action，authority 執行後 reveal 新 snapshot 再分析。
- 勝負只看 KO；雙方同 piece seed、相同 24 frames/placement、每局換 seed、交換座位。沒有一般 frame cap 判勝；watchdog 是不計分技術異常。Mirror 不重複當獨立樣本。
- 靜態前端、Worker、本地運算、PWA；不依賴 backend、SAB／threaded WASM。若用 WASM，完整 hot kernel 留在 WASM，避免逐 node 跨 JS/WASM。
- 不重做 replay viewer、Phase 4 架構、Tetrp Engine；不現在抽獨立 package/TBP。

## Repo 與精確版本

Tetrp workspace：`C:\Users\jush\Documents\ChatGPT\Tetrp`。

- 本地 branch：`codex/kiwi-ft7-actions`
- 已提交 HEAD：`b2529f23a517b2e16f9b6fe9e6c460fa5bc18d6e`
- **下面多數近期報告、scripts/tests 與兩項 Native 修正尚未 commit/push。它們存在工作目錄，不能只看 HEAD 判定現況。**

2026-09-26 `git ls-remote` 實查 upstream：

|Branch|Commit|
|---|---|
|https://github.com/jush0147/cold-clear-2/tree/kiwi-v1|`2e243242b674d57491f99b445f75e35fc48a0e26`|
|https://github.com/jush0147/cold-clear-2/tree/tetrp-authority|`dbdc6b90dca50a79c0ee76047227c55e5a089dcb`|

`vendor/kiwi-v1/kiwi-build.json` 指向 kiwi-v1 同一 `2e24324`，產品版本 snapshot-v3.2。現在對戰稱 Legacy 的就是該 packaged snapshot adapter/core，不可與 upstream 原版 CC2 混稱。

只讀審查 clone：`.cache/cc2-branch-review/`，以 `git clone --filter=blob:none --no-checkout` 建立，尚未 checkout。使用固定 SHA 或 `git show origin/kiwi-v1:<path>` 讀取。Partial clone 可能按需抓 blobs，網路操作要相應權限。不要把這個 cache 當正式實作 repo。

## 已從原始碼確認的初步發現

1. `git diff --quiet` 比較兩分支的 `src/data.rs`、`src/dag.rs`、`src/dag/known.rs`、`src/dag/speculated.rs` 回傳 0：**這四個核心檔在兩個 heads 相同**。不是說整個 repo 或所有搜尋相關檔相同。
2. `kiwi-v1:src/bot/freestyle.rs` 展開候選後呼叫 `state.advance(next, mv)`，再用 resulting state + PlacementInfo 評分，並建立 DAG children。
3. `src/data.rs` 的 GameState 仍持有 board、bag、reserve、B2B、combo、TetrioRules、Forecast。`advance()` 自己更新 bag/reserve、落子消行與後續交易，並呼叫 `forecast.resolve()`。因此 branch 名字帶 authority 不表示深層搜尋使用 Tetrp transaction。
4. `src/forecast.rs` 是明確的 hypothetical model：有限 packet array、scenario 洞位、自己的 activation/clock/cancel/tank 邏輯。`resolve()` 先增加整個 placement 的 elapsed_frames，再處理 attacks，零消行時以固定 `0..8` 迴圈入垃圾、從隊首判斷 readiness。需要與現行 Tetrp 的 lock frame、FIFO/可跳過未 active packet、cap、blocked semantics 逐項做差異測試；**尚未量化實際策略影響，不把 code-shape 差異全當已證實 bug**。
5. `kiwi-v1` 的 root Place 可以使用 authority-derived complete current-pose allowlist；post-Hold hypothetical root 與更深層仍使用自己的模型。Root geometry 正確不能推論 deep transition/spin/clock 全對齊。
6. `tetrp-authority:scripts/lib/tetrp-authority-adapter.mjs` 舊實作維護 observed piece history/frontier bag state；migration plan 也明示此做法。**不符合現在 snapshot-only 要求，不可整包搬回。** 這不是說當前 vendored snapshot-v3.2 在使用該歷史推 bag 路徑。
7. `tetrp-authority` 頂端 commits 多為 snapshot-v2/v3/v3.1 驗收紀錄；kiwi-v1 有 snapshot-v3.2 adapter/worker 等修復。不能僅因名字，假設 authority branch 較新或較完整。
8. Vendored capability ledger 明確承認 exact ARE/bump、full clutch、full opening-double-cancel 等 parity 未完整。舊文件含 superseded entries，必須對照目前 source，而非逐條當成現況。

已讀：兩分支 diff/stat、authority migration plan、舊 authority adapter 前段、DAG known 前段、freestyle 展開、Forecast、GameState advance 片段、vendored build/parity ledger。尚未逐行完成整個 DAG/backprop/hash/transition/adapter 的審查。

## 下一個實際工作：搜尋內部耦合表

沿著以下資料流追蹤，不先開新對戰：

`PublicSnapshot → snapshot/analysis adapter → search root → DAG select/expand → GameState::advance → attack/Forecast → eval/reward → state hash/merge → backprop → root recommendation`

至少檢查：

- `src/snapshot.rs`, `src/analysis.rs`, `src/bot.rs`, `src/bot/freestyle.rs`
- `src/data.rs`, `src/movegen.rs`, `src/forecast.rs`, `src/tetrio/*`, `src/ko_support.rs`
- `src/dag.rs`, `src/dag/known.rs`, `src/dag/speculated.rs`, `src/map.rs`
- `scripts/lib/kiwi-snapshot-adapter.mjs`、snapshot worker、root geometry helper
- 舊 authority adapter/match runner 和 rule fixture exporter，僅作歷史證據

逐項輸出：現行 CC2 語意、Tetrp 對照函式、確定差異／尚待驗證、可保留／需替換／耦合阻礙、最小 differential fixture。尤其注意：

1. 已知資訊下的 deterministic transition 對齊，與未知 tail/hole 的模型假設分開。
2. Clock/garbage/Surge 等增加 state 維度後，DAG merge、hash、evaluation cache、backprop 與 horizon 是否仍合法。
3. Same cells 但 spin/kick provenance 不同不能盲合併。
4. Hold draw consumption、空 Hold reveal 邊界、snapshot statelessness，以及既有 bag/speculation assumptions 是否可安全關閉／替換。
5. CC2 search 是否能與完整 Tetrp-native state/transition 分離。不能假設 generic Evaluation trait 就代表 GameState 抽象化了。
6. Rust/WASM search model 如何共享或移植 pure rule semantics、用 Tetrp differential oracle 驗證；不要把逐 node 呼叫 JS Engine 當效能方案。

交付最小移植範圍與耦合證據後，再決定具體實作。現在不承諾全面移植可行，也不因遇到耦合就自動轉成新搜尋器設計。

## Native 工作：保留／已結束

### 保留（本地已修改）

- `src/analysis/native/model.js`：post-lock 下一個 decision frame 啟用 surviving garbage packets；不可回溯在上一個 lock tank。Unknown activation 維持 frontier，完全取消封包不產生假 frontier。
  - 修改前 360 synthetic conditional fixtures 中 69 個只差 active flag；修正後 0 mismatch。
  - 修改前 1542 個同下一手比較已顯示無 transaction 差異，**未證明它是 0–7 的原因**。
- `src/analysis/native/movegen.js`：同一次 generate 內 drop suffix destination cache。
  - 84 組輸出差異測試 + 2 組完整 rotation-history case 相同。
  - Node 45 pairs 中位延遲降低 20.11%；Chrome Worker 45 pairs 降低 22.95%；search candidates/score/work/TT parity 相同。
  - 固定 1000ms 一次配對檢查：15 states 中 5 個 depth 1→2，無深度退步。不是 strength evidence；正式 geometry budget/evaluator 沒改。
  - 完整回歸 **443/443 passed**，log `.cache/kiwi-cost-full-tests.log`。

### 已結束，不重啟為「新假設」

- 根據少數固定 root 的 KO 結果做價值標籤：pilot 與 replication 未穩定重現。Replication run `36037724891`，48 matches、22840 placements、7710 Holds，correctness 通過。
- 純 generated APP candidate：run `35886665683`，有效 Native 0–7；generated APP .1948 vs .6429。不是「只是攻擊強但不會活」。
- inventory2、queue-progress2、root-fair quota：依事前門檻失敗。
- 全層 one-ply lookahead：固定 geometry budget 未通過；加速後同 1000ms 的最後檢查也失敗。
  - 15 states × 3 pairs = 90 searches，45 pairs top-1 完全相同，所有 request completed depth 2。
  - Candidate 45 次皆 partial-probe stop，0 reused published children。
  - F48 三次 depth2、Legacy-root score -0.80，未找到四手 +0.55 witness。
  - 90 個 root/Hold authority checks 通過，max duration1003.5ms。未啟動 FT7、未接入 production。
  - Browser transform 抽出 `transformLookahead()` 僅為離線重用；三個 targeted tests passed。Production search.js 沒改。

## 證據入口

- [Native 診斷](audits/NATIVE_DIAGNOSIS_2026-09-26.md)
- [同 snapshot root 分歧](audits/kiwi-root-disagreements/README.md)：F24 tie、F48 depth3 pruning、F120 horizon。不是 Legacy action ground truth。
- [root-fair 搜尋配置](audits/kiwi-search-exam/README.md)
- [APP 結果](audits/kiwi-app-result.md)
- [root KO replication](audits/kiwi-root-ko/REPLICATION_RESULT.md)
- [固定 work lookahead](audits/kiwi-lookahead/README.md)
- [效能剖析與保留加速](audits/kiwi-cost/README.md)
- [最後 fixed-time lookahead，已否決](audits/kiwi-lookahead-time/README.md)

各目錄有 PLAN、manifest、result/summary JSON。結果與 scripts 多尚未追蹤，請保留；不能以乾淨 checkout 當作目前工作全部已提交。

## 操作注意

- 使用者希望長時間實驗／對戰交給 GitHub Actions，不持續盯場；完成／異常 ntfy topic：`just_a_kiwi_for_tetrp`。已有明確發通知授權，不需每次再問。現在沒有排程、進行中 arena 或 browser benchmark。
- 下一步是 source review，不是新的 tuning／FT7。Browser benchmark 用 installed Chrome (`channel: chrome`)、headless、localhost fixture server；已關閉 browser/server。
- 最後一次 git status 中有其他工作：`third-party/kiwi-notices.md`、`.codex-remote-attachments/`、`docs/UI_TEXT_INVENTORY.md` 與本工作無關，不要刪改或一起 stage。不要 `git reset/clean` 丟掉未提交紀錄。
- PowerShell。完整 Python oracle tests 使用 `.cache/python-runtime/cpython-3.12.13-windows-x86_64-none/python.exe` 設為 `$env:PYTHON` 再跑 `npm test`。外部 network／必要 subprocess 操作遵守當前權限。
- 不因記錄／交接而自動建立新任務、merge、push、開跑 experiments；不宣稱背景工作會自行繼續。下一次接續從上面的耦合表開始。
