# Accepted Kiwi：參數與規則模型審查

2026-09-28。只做 source audit；沒有修改 bot、權重、production WASM，也沒有啟動 arena。本文不是新的勝率證據。

## 查的是哪一個版本

- 對象是 `ACCEPTED_BASELINE.json` 的實驗版：source `2e243242b674d57491f99b445f75e35fc48a0e26`，artifact run `36387270053`，WASM SHA-256 `ff7c1591d96e1b5968d217e0a215c2a6797ab7a5a6dc0a1b4bac85cf181ad767`。
- Production vendored Kiwi 仍是另一個 artifact，不能把本表當作已部署版本的證明。
- 從本地 Git object 匯出 pinned source，再逐行驗證、套用 artifact `landing-final.patch` 中 bot、freestyle、data、forecast、lib 的 hunks。重建資料在 `.cache/cc2-parameter-audit/`。此 patch 沒改 evaluator 權重及 evaluate 函式；其 spawn/Hold/forecast 修正有納入審查。movegen 另依完整 patch 與既有 differential 結果判讀。
- Source links 以下均指 pinned source；接受版本對上述檔案的差異以 artifact patch 為準。

## 真正生效的設定入口

`src/analysis/kiwi.js` → snapshot adapter → Rust `snapshot::analyze_text` → `analyze_snapshot_branch` → `BotConfig::review_h9_h12()`。

不是直接使用 default.json，也不是 interactive_review。設定繼承順序是 default → legacy() → review_h9_h12()。

- 每個 request 200,000 nodes，24 frames/placement。
- 可 Hold 時 Place / Hold 各分 100,000；Hold 後重新分析是另一個 request。
- 有 incoming 時，每個 branch 的 budget 再分給 10 個洞位 scenario；unknown activation 再交叉三種時序，共 30 個。不能把 200k 說成每個 scenario 都有 200k。
- current + NEXT 5、Unknown randomizer、finite-visible frontier；空 Hold 的假想分支只保留仍知的 5 顆，沒有補讀新 NEXT。
- snapshot Request 是 deny_unknown_fields，沒有 profile / strategy override 欄位。通用 analysis 的 tuner profile **不能直接套在產品 snapshot 入口**。調參必須保留這條公平入口，新增受限設定或做可追溯的 build-time override。

Sources: [snapshot.rs](https://github.com/jush0147/cold-clear-2/blob/2e243242b674d57491f99b445f75e35fc48a0e26/src/snapshot.rs), [bot.rs](https://github.com/jush0147/cold-clear-2/blob/2e243242b674d57491f99b445f75e35fc48a0e26/src/bot.rs), [analysis.rs](https://github.com/jush0147/cold-clear-2/blob/2e243242b674d57491f99b445f75e35fc48a0e26/src/analysis.rs)。

## Active evaluator inventory

Reward 在 search 邊上累加，leaf Eval 透過 DAG 回傳；不是每層都把 board Eval 累加。

| 項目 | 有效值 | 作用 |
|---|---:|---|
| newly sent | +1 / line | forecast 交易後的 sent 增量，包含公開 multiplier / opener / cancel 的結果 |
| cancellation | 0 | 無額外直接 reward；仍影響 pending、tank board、存活 |
| normal clears 0–4 | 0, -2, -1.5, -1, +3.5 | 舊式 shaping，不是 TL attack table |
| mini clears 0–2 | 0, -1.5, -1 | 舊式 shaping |
| full spin clears 0–3 | 0, +1, +4, +6 | 舊式 shaping |
| B2B clear | +1 | PlacementInfo 的 normal B2B bonus 成立時 |
| combo shaping | +1.5 × floor(max(info.combo−1,0)/2) | info.combo 是這次 clear 前的計數；不是 TL multiplier 公式 |
| perfect clear | +15 | override=true：此項取代該次 legacy clear/B2B/combo shaping；不取代 newly sent |
| wasted T | -1.5 | 使用 T 但不是 full spin 且至少消 2 行的情況 |
| live B2B leaf | +0.5 | 只有是否持有；不按 charge 大小增加 |
| H3 B2B charge / Surge bank leaf | 0 / 0 | 沒有額外未實現庫存價值；實際釋放送出仍進 newly sent |
| holes | -1.5 | T-slot 假想切除後的垂直 holes |
| coveredness | -0.2 | 每個 hole 的覆蓋深度 capped at 6；H6 scales 均為 1 |
| max height | -0.4 | 再加超過 10 的 -1.5/格，超過 15 的 -5/格 |
| row transitions | -0.5 | default -0.2 × review 2.5，非單純讀 JSON 的 -0.2 |
| Tetris well depth | +0.3 | 幾何井深 proxy，不要求已知 I 能兌現 |
| T-slot clear count 0–3 | +0.1, +1.5, +2, +4 | 幾何模板及假想消行，見下一節 |
| H9 cavity excavation | -0.5 | 真實盤面 sealed empty component 的最低垂直挖掘量 proxy |
| pending safety H1 | 1 | 額外按 min(pending,16)/8 放大真實盤面 holes/coveredness/超高懲罰 |
| softdrop | 0 | 不評估按鍵操作成本 |

H1 在 T-slot 假想消行前計算，基礎 holes/height/transitions 等在假想消行後計算。因此「洞的權重」不是只看 -1.5；pending、T-slot 與 H9 都會改變總效果。

來源：[default.json](https://github.com/jush0147/cold-clear-2/blob/2e243242b674d57491f99b445f75e35fc48a0e26/src/default.json)、[freestyle.rs](https://github.com/jush0147/cold-clear-2/blob/2e243242b674d57491f99b445f75e35fc48a0e26/src/bot/freestyle.rs)。機器可讀有效設定另見 `ACTIVE_PARAMETERS_2026-09-28.json`。

### 名稱容易誤導、目前不該調的項目

- `tetrio_s2=false` **只是 evaluator 分支，不是停用 TL gameplay**。GameState::advance 仍用 public rules 算 B2B、attack packets、multiplier，再做 forecast transaction。
- 該分支裡的 `attack_reward=1`、`surge_value=1`、`b2b_charge_value=.5`、`legacy_shape_value=.5` 目前不生效。現在 legacy shaping 是全額，不是半額。
- 不能隨手把 `tetrio_s2` 打開：其 raw attack reward 與 H2 sent 會疊加，且該舊 Surge leaf helper 使用預設 threshold/base；需要先對照 public rules。這是 dormant path 風險，不是現行交易已知算錯。
- known-layer exploitation=ln(2) 生效；speculated exploitation 雖也設 ln(2)，finite-visible 不展開 unknown tail，因此不是這條入口的有效 tuning knob。
- H12 best-child demotion propagation=true；H13 despeculation=false。fresh snapshot、無 speculative tail 的流程不能照 persistent SevenBag bot 的理由去調 H13。

## 規則錯誤、策略假設、支援邊界分開看

### 1. 已確認：T-slot 殘值仍有 synthetic bag 假設

Unknown 初始化 `bag=all seven`；每個 simulated advance 移除 next，空了才 reset。Evaluator 使用：

`cutout_count = bag.contains(T) + (reserve == T) + (bag.len() <= 3)`。

例如起始 all-seven，在模擬非 T 後即使仍知 queue 沒有 T，第一項也可以給一次 T cutout；移除 T 後又會取消第一項。這不是 hidden RNG/history 洩漏，但也不是經由公開資訊成立的真實 bag remainder。預測模板沒有證明可達、spin provenance 或能在 visible horizon 兌現。

更重要的是，它不只加 T-slot bonus：若假想消超過 1 行，後續基礎盤面分數改在切除後盤面計算。因此只把 tslot 四個係數設 0，**不會關掉這個機制**。

判定：evaluator 的舊資源假設，並非 authority transition teleport。值得先用 isolated diagnostic 顯示：真實 board features、cutout 前後差值、reserve 是否代表空 Hold 的 current、visible remaining T 數。空 Hold lineage 已有獨立欄位，但這個評分公式仍只看 reserve==T，解讀時不可一律稱為「Hold 裡的 T」。

處理：不先全面刪除 T-slot。先確認真實 corpus 觸發與 ranking 敏感度；若要改，做單一、明確的可見 T availability 假設或整個 cutout 機制 ablation，不要和權重 sweep 混在一起。不要把未知 frontier 的 T 價值直接宣告為零就是正確答案。

### 2. 已確認：一般 replay 的 ARE timing 尚未完整建模

snapshot adapter 接受並傳遞非零 garbageare/garbagearebump；Rust 保存/回報這些值，但 Forecast 不模擬完整 ARE/bump 流程，garbage_locked_until 也不參與該 transition。正的 existing ARE queue 會拒絕。

目前 strength arena 的 `assertPlacementContract()` 要求這些 ARE 值為零，所以這不是既有合法 arena 勝負無效的證據。一般 replay recommendation 的支援範圍卻比精確模型更寬。

處理：arena 繼續嚴格拒絕超出 contract 的規則；在宣稱 viewer 全規則精確之前，明確限制支援域或補 ARE timing differential model。不能調 evaluator 權重補掉時序規則。

### 3. 已確認：garbage uncertainty 是簡化模型

- 每個已公開 packet 假定整包同洞；scenario 洞位為 `(scenario + 3*packetIndex) % 10`，不是獨立遍歷所有多包組合。
- 十個 scenario 等權；未知啟動時間用 1、cadence+1、600 frames 三種示意情境，不是校準後的機率。
- 每個 scenario 個別規劃 continuation，再平均 root score；對尚未揭露資訊可能有樂觀性，不是完整 belief-state policy。
- 不加入未知對手未來攻擊；H1 pending pressure 不直接按距離到達時間折減，雖然 transition 會用到達時間。

判定：公開資訊下的 model assumptions，不是偷看 future，也不能由根節點 lock parity 證明準確。此輪先固定，避免和 evaluator 調參一起變動；之後若真實 trace 顯示主導失誤，再單獨比較。

### 4. 已修正與尚未證明的界線

Accepted patch 已含 lock-frame activation、ready queue scan、40-bit clipping、failed insertion debit、mid-descent landing、spawn terminal/Hold lineage 等修正。本次沒有把 pinned 舊 Forecast 的那些錯誤重新列成現行 bug。

既有 1,746 個 spawn-reachable rotation probes、combined authority checks、arena top-1 parity 是有限證據。整數 y 的 conditional primitive 差異在另組 probe 存在，但沒有在該 spawn-reachable corpus 重現，不能拿 186/564 當實戰錯誤率，也不能宣稱所有深層 search transitions 已被完整證明。

24-frame arena 是 authority-validated atomic placement，主動排除 physical gravity/auto-lock input transport；未證明真人 40×/無限 soft drop 能在 24 frames 執行。這是實驗定義，不能當成靠權重修的 TL attack bug。

## 下一步固定順序

> 已被後續使用者討論取代：以下保留為歷史提案，不再執行。現在以 [EVALUATOR_ALIGNMENT_PLAN.md](EVALUATOR_ALIGNMENT_PLAN.md) 為準：先全部現有項目的語意／環境對齊，再驗證機制，最後才調權重。

1. **先把實际評分可觀測化**：同一 accepted source、同一 PublicSnapshot，輸出 active config hash、reward 分項、真實與 cutout 後 leaf 分項、scenario 數及實際 node allocation。關閉診斷時維持原決策與預算。不要繞到 generic analysis 丟失 snapshot 限制。
2. 使用既有對戰 snapshots 做小型對照，量出 H2 sent、legacy shaping、H1、T-slot cutout 各自對排名的影響。這能選定合理的第一個 knob，但不能證明改動更強。若找到可重現的 supported-rule transition mismatch，先局部修正和 differential 驗證，與 tuning 分開。
3. 沒有 rule blocker 時，第一個參數實驗優先檢驗 **newly-sent reward 相對固定 legacy shaping 的權重**。先由上述分項決定有意義的小範圍，不同時改 T-slot/H1/B2B 或 search budget；不是直接最大化 APP，也不表示現在已證明攻擊權重過低。
4. 固定 200k nodes、24-frame cadence、對手版本、snapshot 邊界；配對 seeds/seat swap、KO-only、zero fallback、top-1 parity gate。用保留 seeds 確認，而不是反覆拿同一組挑 winner。未過 gate 的結果不算 strength。
5. 再依第一項診斷決定是否做 T-slot availability/cutout 的獨立 ablation。沒有證據前不重寫 search、不增加到 300k，也不開大型 tuning。

本次結論：**可以進入有控制的調參，但不能只改 default.json，也不能把 evaluator 的舊近似當作已完整 TL 對齊。** 目前尚未證實哪個權重造成勝率損失；本次確認的是可調入口、有效參數與需分開處理的模型邊界。
