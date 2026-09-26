# CC2 → Tetrp 規則耦合審查

2026-09-26。這是 source audit；沒有變更 production policy、evaluator、arena 或 WASM，也沒有開新對戰。

## 結論與固定方向

**可以保留 CC2 的 DAG 搜尋機制；不能只改 adapter 或 attack 公式就宣稱完整對齊。** 目前沒有看到 DAG 排序／回傳演算法與 TL S2 根本不相容的理由；但 GameState、動作、layer 的 piece 假設、movegen 和 Forecast 必須一起處理。這是有明確範圍的規則核心替換，不是重新設計另一個 beam，也不是直接回到舊 Legacy。

以 `kiwi-v1` 為實作來源，`tetrp-authority` 只取歷史 fixture／設計背景。先把固定 cadence placement model 對齊；不把成功範圍擴稱為任意 replay 時序／TBP 的完整等價。**尚未證明移植後速度或勝率，也未把下列差異宣稱為 Native 敗因。**

## 版本與證據邊界

- Tetrp committed HEAD：`b2529f23a517b2e16f9b6fe9e6c460fa5bc18d6e`，另有 handoff 所列重要未提交修改。本次以工作目錄 authority 為準。
- [kiwi-v1](https://github.com/jush0147/cold-clear-2/tree/2e243242b674d57491f99b445f75e35fc48a0e26)：`2e243242b674d57491f99b445f75e35fc48a0e26`，亦為現有 vendored snapshot-v3.2。
- [tetrp-authority](https://github.com/jush0147/cold-clear-2/tree/dbdc6b90dca50a79c0ee76047227c55e5a089dcb)：`dbdc6b90dca50a79c0ee76047227c55e5a089dcb`。
- 兩 branch 的 `data.rs / dag.rs / dag/known.rs / dag/speculated.rs` 相同，不代表所有檔案相同。
- Source 由 pinned Git objects 讀取；部分複本在 `.cache/cc2-audit-source/`。現行 Tetrp 外層呼叫也另行追查。
- `source-witnesses.mjs` 有三項可執行對照，但 CC2 側是摘出的表達式，**不是編譯執行 Rust kernel**。本機 PATH 未找到 Rust，這輪沒有建立 Rust toolchain。完整 differential certification 是下一步，不是已完成事項。

## 真實資料流

```text
Engine private state
  → visibleState() allowlist
  → prepareKiwi() / snapshotAuthority() public facade
  → authority current-pose root geometry
  → kiwi-snapshot/3 request
  → snapshot::analyze_text()
      Place root：完整 allowlist
      Hold root：假設交換後的 known prefix，分配另一半 budget
  → analysis::analyze_snapshot_branch()
      每個 hole / timing scenario 各建一個 Bot + Forecast
  → Freestyle::do_work()
      Dag::select()：沿每條已選 edge 重跑 GameState::advance()
      movegen：root 可用 allowlist，深層／post-Hold 用 CC2
      GameState::advance() → tetrio::attack → Forecast::resolve()
      evaluate() → ChildData {resulting_state, placement, eval, reward}
  → StateMap hash/merge → known layer max backup → parent propagation
  → per-scenario root scores 取平均 → Place/Hold 排序
  → normalizeTopRecommendation()（strength arena）
  → validatePlacement()/commitHold()
  → commitPlacement() at slot+23, subframe .5
  → Engine.lock() / attack transaction / tank / spawn
  → 新 PublicSnapshot，重新分析
```

`normalizeRankedRecommendation()` 與 upstream `selectReachableSnapshotAction()` 仍有 fallback 迴圈，但 strength route 在 `scripts/kiwi-profiles.js` 使用 `normalizeTopRecommendation()`。不要為了復用 upstream adapter 把 fallback 帶回。viewer 的 transport 是另外的產品路徑。

## 耦合表

|部位／現行函式|實際語意與證據|決定／最小驗證|
|---|---|---|
|`snapshot.rs::make_start`, `lib.rs::create_bot_with_search_context`|產品傳 `Randomizer::Unknown`，`speculate=false`；未知 tail layer 不展開。沒有讀歷史或真正隱藏 queue。|保留 snapshot 邊界與 finite frontier。不要誤認 generic analysis/TBP 的 SevenBag 路徑是現行產品路徑。|
|`snapshot.rs::post_hold_root`|occupied Hold 不消耗 NEXT；empty Hold 只用 N1–N5，沒有補未知 N6；輸出 standalone Hold 並要求重分析。|保留外部 contract。內部應明確表示 current、optional Hold、cursor、hold lock，不能只靠 piece type 推斷 Hold。|
|`lib.rs` 空 Hold normalization|把 current 當 reserve，queue 只剩 NEXT；每個 DAG layer 固定消耗一個 next。空 Hold Place 分支實際只有五個 known layers，即使輸入長度 metadata 是六。這是 delayed-reserve representation，不等於外部真的按了 Hold。|不直接判成外部 Hold 錯誤，但它限制 horizon／queue 語意。fixture 比較空／有 Hold、current=N1、same-type occupied Hold、最後一顆可見 piece。|
|`dag.rs::Dag::select/advance`, `freestyle::do_work`|不只 expansion 呼叫 transition；selection 沿途重算 state。Dag 只泛型化 Evaluation，GameState/Placement 是 concrete types。|兩條路徑必須共用同一 compact transition，不能只在 expansion 插一個 authority hook。測 replay-edge state 等於 stored child state。|
|`movegen.rs::find_moves_with_clutch`|bitboard collision maps、低盤面 fast path、spawn reachability、canonical landing；visited 只有 Placement+softdrop cost。沒有 totalRotations、fractional y、hy 等 authority history。|保留 bitboard/collision 技術；合法移動、rotation history、spin provenance 改由 Tetrp 對照模型定義。先逐局部 primitive，再整個 landing set 比較。|
|`movegen.rs::rotate` vs Tetrp `rotation.js/physics.js`|CC2 kick 座標加整數，T full 的特殊 kick 有額外朝向／dy／90度限制。Tetrp 使用 `kickY`、`totalRotations` 門檻、`kick===3`，O 不走一般 kick。|確定表示法／條件不同；可達集合差異尚未完整枚舉。不能以同 cells 就合併中途 pose；需合法 witness。|
|CC2 drop vs `Engine.descend/slam`|CC2 下降距離>0 一律清 spin；Tetrp hard-drop 的 `slam(true)` 可以保留已取得 spin，一般下降清除。|區分 drop edge 類型；用 rotate→drop、rotate→descend→drop、180、O rotation-history fixture 驗證。不要假設只有 T 有 provenance 需求。|
|`data.rs::GameState::advance`, `tetrio.rs`|已做 TL mini base、combo multiplier、B2B raw/display轉換、Surge packet順序、AC額外packet；不是完全原版 CC2。combo u8、B2B u16 飽和，且 rules 支援面受 adapter 限制。|可作 port 對照，不作 authority。移植 `attack.js` transaction；保留分 packet 順序，測 opener 邊界、AC+B2B、Surge+ordinary+AC、multiplier floor。|
|`Forecast::resolve` clock|先 elapsed+=24 再用 ready_at<=elapsed 入垃圾；`next_attack_multiplier` 卻使用 frame+23。|確定同一 placement 兩種時間邊界。activation=23/24/25 fixture；next-decision啟用不可回溯上個 lock。|
|`Forecast::resolve` tank|只看隊首 ready、硬編碼 cap8；Tetrp `tank` 跳過不active/status/shielded。adapter 已把cap8與packet類型限制住，所以不能把所有缺欄位一概列成現有run bug。|符合支援合約的 cap8 可保留常數 specialization；active先後次序仍要 parity。未知洞只是假設，不是規則差異。|
|`Forecast::resolve` storage boundary|full top-row檢查已修，但 `col<<1` 沒截成40bit，garbage_rows亦同；Tetrp `pushLine` 丟掉最頂行。|確定 representation 差異；partial-top witness 後 CC2 殘留bit40，authority不留。要測後續height／clear／topout，不只第一手是否死。|
|`ko_support::cancel_plan`|pieces<opener 比對 Tetrp 先 pieces++ 再 <=opener，在一致計數下等價；普通attack先抵消、bonus不外送亦有對照。|**不能僅因 `<` vs `<=` 判bug。** 無 hardened/ARE 的現行合約可對照；多packet/Surgesequence仍須完整測試。|
|spawn／clutch|CC2 選到後續節點才產生 current 與 reserve moves；即使 current 無合法spawn，reserve也可能有moves。Tetrp `lock()` 先 spawn current，blockout 死後不能再 Hold。|必須明確處理 spawn terminal，不能用後續 Hold 救已KO狀態。這是 source-level風險，待高盤面fixture重現；clutch只在前手clear成立。|
|`map.rs::StateMap`|Hash涵蓋完整 GameState，包含 Forecast、clock、packets、sent；不是只hash board。但實際表只存u64→Node，不驗原state equality。|保留transposition概念；改成有key equality或可驗collision的node ID。加入新state欄位不代表layer假設自動正確。|
|`dag/known.rs` / `dag.rs::update_child`|child value = residual eval + edge reward；known parent取best。H12 demoted-best回傳修正在review_h9_h12啟用。|保留這套ordering/selection/max backup，不另造beam。測diamond、best被降級、terminal、partial expansion不發布。|
|`dag/speculated.rs`|用bag選next並平均best；目前snapshot產品沒走此路徑。|第一版不接回。H13 despeculation不是每次重建snapshot DAG的主要修復目標。|
|`freestyle::evaluate`|bag.contains(T)、reserve==T、bag.len<=3決定T-slot cutout；cutout後盤面再算holes/height等。即使speculate=false，bag仍由advance遞減。|**關閉tail不等於清除bag假設。** 非隱藏資料洩漏，但不具可靠bag知識。改用明確可見piece資源或停用該推袋項，獨立記錄必要相容性改動；不順便tune其他feature。|
|`analysis.rs` scenarios|10個clean-hole情境；未知activation擴成30個。各情境独立最佳化continuation後平均root分數。|有 strategy fusion：尚未reveal前也可能按scenario分支。不是偷讀replay，但不是真實資訊下同一policy。首版改在不可知transition前停止；之後才加共享公開prefix的scenario search。|

## 三個已執行的 source witnesses

執行 `node docs/audits/cc2-alignment/source-witnesses.mjs`，三項 assertions 通過：

1. packet在+24啟用、當手+23 lock且不消行：authority此lock不tank；Forecast readiness expression會tank。
2. inactive隊首2行、後面active3行：authority tank3；Forecast隊首邏輯tank0。此為條件state，未證明目標arena中該順序實際出現的頻率。
3. storage top只有一格、插一行hole0：authority丟掉舊頂格；Forecast expression把它留在bit40。

這些不是整體模型的通過／失敗比例，更不是勝率歸因。後續用真正編譯的CC2 transition重跑，不能拿這份摘錄取代它。

## 最小替換範圍

### 保留

- Rust/WASM Worker部署、一次request輸入輸出，search RNG與環境seed分離。
- bitboard與collision加速的技術；整塊hot loop留Rust。
- 有限已知資訊的DAG探索、候選排序、Eval+edge Reward、H12 backprop。
- 現有Legacy profile先凍結作遷移控制組；不是宣稱它是理想evaluator。
- Tetrp的PublicSnapshot、placement certificate、Hold重分析、arena KO與parity audit。

### 替換／調整

- `SearchState` 明示board/current/Hold/可見queue cursor、raw combo/B2B、publicpending、clock、opener counters、terminal/frontier。immutable rules/known queue可放request context，不逐node複製；所有影響未來的可變資料要進key。
- `Transition` 是唯一決定 child state、attack packets、cancel/send/tank、spawn/clutch 的核心；selection與expansion都使用。產生 `PlacementOutcome` 供reward讀取，避免 evaluator 重算另一套attack。
- 中途 `Pose` 包含 authority rotation/provenance 所需history；落定後若已完成spin/transaction且不再影響未來，才可以安全合併。不同action的edge reward保留在各edge。
- 放棄「每個layer一定是同一next piece」假設，layer仍以placement depth分層，但current/cursor由node state決定。Hold內部可展成一個有明確Hold前置步驟的placement edge；外部若選Hold仍只回Hold並重新分析。不得因macro而跳過Hold spawn failure、hold lock或unknown reveal。
- 這要求調整 known-layer children／edge identity，不只是換一個trait。可用穩定edge ID避免same-type Hold與same-cells不同provenance被混淆；仍保留CC2 selection與backup演算法。
- 未知piece／hole／activation先用明確frontier停點；不得虛構安全spawn或把scenario未reveal資訊當決策條件。葉節點保留pending pressure的heuristic是價值近似，不是已完成的garbage transition。
- state lookup 要驗 equality；分離過往累積reward與未來必要state。`cumulativeSent`影響opener，不能以「只是過往reward」刪掉。

### 不在這輪做

任意ARE/continuousgarbage/真實鍵盤cadence、persistent跨requestDAG、unknown-tail新演算法、evaluator重設計、TBP、獨立package、神經網路。支援範圍必須顯式列出，不能在unsupported rules下默默近似。

## 下一步與驗收順序

1. **先建真正Rust transition differential入口。** 固定上述commit，JSONL輸入只含public snapshot／合法action及明示hypothetical hole/time；JSONL輸出before/after、packets、cells、spin、clear、Hold/cursor、clock、spawn/KO。用本地Tetrp authority作oracle；私有seed／checkpoint只留oracle，絕不交policy。先重跑三個source witnesses與opener/Surge控制案例。這是下一個具體工作，不是再開strength arena。
2. **先讓transition/movegen通過，再接DAG。** 對current active pose、post-Hold、clutch、toprow、180、rotation history、packet邊界做whole-result differential；比較合法候選集合與每條witness。攻擊邏輯由現有pure `attack.js`語意移植，CI持續對照，禁止最後root正確就宣告深層正確。
3. **接回CC2 known DAG，固定profile。** 測selection replay=storedchild、hash/equality、edge reward、emptyHold horizon、partial budget、best demotion；對完整可見短prefix逐步比較authority。bag-based項的必要修正單独記錄，不混入一般調權。
4. **Worker效能門檻。** 同一批snapshot量測延遲、node/work、記憶體與UI responsiveness；以現行Legacy在相同request預算為對照。若成本過高先profile compacttransition，不跳回Nativebeam。
5. **小場correctness smoke，再FT7。** top1/Hold/spin/cells/clear/lockframe全parity，zero fallback/technicalfailures；KO唯一勝負，同seed／cadence／seat swap。完成才讓Actions跑strength實驗並ntfy；不用持續盯場。

停止或修正範圍的判準：完整支援合約內transition無法對齊、或compactkernel在browser成本無法承受時，先交具體fixture/profile；不以「沒立刻贏Legacy」當規則移植無效，也不因幾個單元測試通過就宣稱強度提升。此審查不保證會贏，但給出了可驗證、保持單一路線的工程步驟。
