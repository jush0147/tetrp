# Arena 效率插入工作（2026-09-30）

2026-10-01 最新接續：已實作隔離、default-off 的 512-entry request-local movegen cache 實驗，見 [MOVEGEN_CACHE_EXPERIMENT.md](MOVEGEN_CACHE_EXPERIMENT.md)。本機 source transform 驗證通過；Rust / 六個 WASM builds / 完整 parity / 三輪 paired request timing 交由單一有界 CI。沒有 arena、沒有 production promotion；10% 收益門檻與原參數次序不變。下段「尚未實作」是前一輪狀態。

2026-10-01：現行搜尋核心已 profile 完成，見 [CURRENT_SEARCH_COST.md](CURRENT_SEARCH_COST.md) 與 JSON；兩個 artifact 共 72 完整 report parity。movegen inclusive 約 41–43%，GameState hash self 約 8–10%，do_work self 不能解讀為 evaluator 單項。下一個有限候選是 request-scoped bounded exact-input movegen result cache，需先證明命中與完整 request 收益；尚未實作或派 CI。不是重寫搜尋或改參數，不重跑已完成的 dense/landing 優化。

最新接續：完整 recommendation 已量完，見 [RECOMMENDATION_EFFICIENCY.md](RECOMMENDATION_EFFICIENCY.md)。兩個 frozen kernels、24 公開局面、兩輪交錯順序，96 組完整 request/report/action/certificate parity；candidate 耗時減少 15.18%，baseline 15.28%。WASM search 現占約 87%，沒有改核心或預算。不得把局部 2.73× 當整場加速；尚未跑新 arena。若再做效能調查，定位搜尋核心成本而非繼續微調小占比 runner，不改參數主線。

最新已完成結果：[ROOT_ENUMERATION_EFFICIENCY.md](ROOT_ENUMERATION_EFFICIENCY.md)。同一 root 枚舉保留所有 graph 狀態，改為共享 geometry/key prefix 與數字 counter visited 集合；24 真實 snapshots × 2 次完整 parity，局部耗時 12.65s → 4.63s（2.73×），另六個完整 WASM report 一致、27 回歸測試通過。這是 root 枚舉的加速，非整場加速。未啟動 arena，未改 evaluator／budget／Hold reanalysis。下方「尚未套用加速」描述的是本次調查開始時的狀態。

本文件只記錄本次測試流程／執行效率問題。原參數工作與次序保留在 MECHANISM_EXPERIMENT_PLAN.md；完成這項插入工作後回到 visible-T，比較結束才按原順序做 H9-off、H1-off。不要因此重新設計 evaluator、救 Native 或開始神經網路。

## 使用者要求與目前狀態

- 使用者指出測試方法零碎：每次少量場數、人工往返，長時間仍不能回答機制是否有用；並要求研究舊 Kiwi 的批次測法。單局慢是另一個成本來源，不能只談加 runner。
- 原 8 場是 4 seeds × seat swap 的單局 KO pilot，不是 8 個 FT7。3–5 不能淘汰 visible-T。
- 48 場 replication 草案未 commit/push/dispatch，workflow 已移除 push 觸發。後續 assistant 提出 200 場（100 seed blocks × seat swap），也沒有啟動。不要誤稱已有 run 或直接執行暫存 48 場設定。
- 未修改 bot/evaluator；尚未套用加速或降低品質條件。
- 同一局雙方 piece seed 相同；同一組交換 policy 座位再打一次，下一組才換 seed。Hole stream 沿既有 seat-based 規則，不把 piece seed 與 hole seed 混為一談。保持 current + NEXT 5／snapshot-only。
- 固定 24 frames、200k nodes/request、Tetrp authority、KO only、zero fallback、placement/Hold/spin parity。Hold 後重新分析不直接刪除；watchdog／job timeout 是技術異常，不能裁勝負。
- 完成由 ntfy topic just_a_kiwi_for_tetrp 通知，不需持續監看。不得為增加速度改成雙方不同 piece seed。

## 已查實的成本證據

1. 舊 CC2 run [35392726671](https://github.com/jush0147/cold-clear-2/actions/runs/35392726671)：200 場，約 2 小時 7 分；10 個 batch jobs、最大並行 5，使用 frozen release binary、200k budget。
2. 舊 Tetrp run [35462770822](https://github.com/jush0147/cold-clear-2/actions/runs/35462770822)：400 場，約 3 小時 29 分；最大並行 8，Node WASM、200k budget。log 實際解析到 400 筆 match，平均 lock_steps 329.33。該歷史配置雙方不同 piece seeds、使用舊 adapter／transport，不可直接當成現行公平模型的基準勝率。
3. 新 pilot 36707273929：8 jobs 同時執行，每局約 6–35 分，平均 job 約 22.8 分。7,244 placements、2,695 Holds/reanalyses、9,939 requests；每邊每場平均 452.75 placements。Hold reanalysis 使 request 數比 placement 數多約 37%，這只解釋部分成本，不能直接認定是冗餘。
4. 本機在新 pilot leg0 的 decision indices 0/100/400/800/1200/1700 抽六個真實 snapshots：prepareKiwi 約 95–420 ms，WASM search 約 762–1370 ms；一個 normalize 約 286 ms，其餘約 0–5 ms。這只是單次局部量測，非受控新舊性能比較，不能用來宣稱完整瓶頸已找完。
5. 舊 Tetrp 測試也用 WASM 與 200k，因此不能把差距全部歸因 WASM 或 budget。不同 opponent／資訊／規則模型及局長也有影響，尚未完成同條件歸因。

本地證據：.cache/old-h9-200k-run.log、.cache/old-h9-final-run.log、.cache/arena-throughput-sample.mjs、.cache/arena-throughput-sample.json。舊來源 .cache/kiwi-source，HEAD 2e243242b674d57491f99b445f75e35fc48a0e26；workflow 有舊批次篩選、確認樣本及統計摘要可參考，但不能整包搬回舊資訊模型。

## 下一個有限工作與品質門檻

先對已保存的代表性 PublicSnapshots 做成本拆解，找出重複計算／配置／路徑枚舉等可消除成本；不為了診斷先跑新 200 場。不重做已通過的規則對齊或語意 witness。

優先保持輸入、搜尋預算、完整決策輸出、authority 結果不變的改進。任何可疑 cache 必須包含所有影響結果的公開欄位並驗證 parity；native 執行核心也須先驗證與 WASM 一致。減 nodes、改 movegen、刪 Hold reanalysis 或放寬檢查都不是可直接採用的無損加速。若 top-1 改變，當成 policy 變體，不能混用舊證據。

測試方法方面：固定 seeds／樣本／停止條件、一次完成矩陣及自動摘要，減少人工小批往返。篩選與獨立確認分開；對小幅差異可能無法定論，不續跑到贏。此處不是新增三候選同時開跑的決策。

完成有限成本調查後，用實測更新 200 場的配置、成本與是否值得執行；回到 visible-T 的強度問題。若找不到足夠無損加速，明確報告，不無限延長插入工作，也不偷偷降低品質。

## Actions 限制與先前說法修正

6 小時是 hosted 單 job 限制，不是整個 workflow；Free 標準 runner 最大並行 20。低於硬限制不代表任何用量都符合條款，仍須符合 repo 軟體測試用途與合理負擔。先前 6–8 小時只是 200 × 22.8 / 12 的粗估，不是平台要求、不可避免的耗時或已驗證 SLA。

- https://docs.github.com/en/actions/reference/limits
- https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#actions
