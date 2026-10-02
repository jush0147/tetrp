# 從語意盤點轉入最小機制比較

2026-10-02 接續授權：使用者已確認 H9-off（既有 −0.5 關為 0）意義及 correctness gate，指示開始。[H9-off 計畫](H9_OFF_200_PLAN.md)以單一 workflow 串候選 gate → 固定 200 KO；只有 gate 成功才派 shard。從 accepted 獨立建立，沒有 visible-T、H1 或其他權重變更。沿用既有 16 runners／2 matches 配置與 ntfy；不需使用者再接下一步。Run ID 確認後另存。

2026-10-02 結果更新（覆蓋以下歷史進度）：[固定 200 場結果](VISIBLE_T_200_RESULT_36892959080.md)已完成。visible-T 97–103、配對近似 95% CI 41.53–55.47%，correctness 全通過；未證明改善，也不是證明等價或無用。不 promotion、不追加到贏。下一項為從 accepted baseline 獨立建立 H9-off，再 H1-off；本次未派送下一批。200 場實際 1h46m16s，沿用已驗證 runtime，不再插入效能 pilot。

2026-10-02 最新：two-match 完整 arena gate run 36887925067 通過，兩場在單 runner 共 20:09，trace 完全等同 frozen reference。執行組合固定 native + parallelDecisions + 2 match workers/runner；下一步準備 visible-T 正式固定 200 場配置與配對判讀，不再新增效能 pilot。200 場未派送；參數順序不變。

2026-10-01 最新 throughput 結果：run 36863657491 等量 public-snapshot workload 的 2 workers/runner 比 1 worker 省 23.64% wall time，完整 parity 通過；可用於下一步固定 visible-T batch harness 設計，尚未量完整雙場 arena，也未啟動 200 場。停止 worker 數掃描；visible-T → H9-off → H1-off 順序保持。

2026-10-01 最新：parallel native gate run 36859147183 通過，完整 reports/events 與 serial 及舊 native 一致，整場較同 run 串行省 35.26%。可用 native + parallelDecisions 跑後续 visible-T 固定樣本比較；200 場尚未 dispatch，visible-T → H9-off → H1-off 次序維持。

2026-10-01 接續：200 場仍未啟動。使用者不接受目前成本，現做唯一 bounded native serial/parallel decision gate（PARALLEL_ARENA_EXPERIMENT.md），保留同 virtual frame 與 transaction order。沒有新 evaluator 假設、沒有改參數次序。

2026-10-01 最新 gate：native 完整 arena run 36851791560 通過，整場耗時減少 17.68%，全部 reports/events 一致。接下來可用凍結 native profiles 落實 visible-T 的 200 場固定樣本批次；未 dispatch。舊 pilot seed 的 runtime 重打不納入強度樣本。visible-T → H9-off → H1-off 順序不變。

2026-10-01 最新效率 gate：native vs WASM 的 170 次完整比較通過，兩個 profile 完整 request 均約省 16.5%。下一步先接離線 arena 並驗證連續 authority/Hold parity；尚未完成整場驗證，200 場仍未啟動。本表的參數先後不變。

2026-10-01 最新：使用者要求不要因 cache 失敗就結束效率工作，已授權 native release vs WASM 等價性／效能實驗（NATIVE_RUNTIME_EXPERIMENT.md）。下段的「已結案」不再是現況。參數順序仍保留；200 場暫不啟動。

2026-10-01：效率插入工作已結案。Root 枚舉優化保留；request-local movegen cache 在 run 36844153120 完整 parity 通過但變慢，依預定門檻淘汰。回到本文件的 visible-T 主線，下一步落實較大固定樣本的批次配置與成本；尚未啟動 200 場提案或 48 場草案，不跳 H9、不改權重。

## 2026-09-30 接續索引：參數主線保持不變

使用者明確要求保留的是「各個參數的處理順序」。arena 效率是另外的插入工作，記在 [ARENA_EFFICIENCY_HANDOFF.md](ARENA_EFFICIENCY_HANDOFF.md)，不能取代本表或造成參數重排。

- 總順序：語意／環境對齊 → 機制有效性 → 權重調整。
- 已完成深入語意檢查的先後：T-slot → H1 pending safety → H9 cavity；三項的結果文件均已存在，不重做。
- 已排定的機制比較先後：visible-T → H9-off → H1-off。語意審查順序與對戰順序不同，勿混淆。
- 目前停在 visible-T：WASM/browser gate 與八場 correctness pilot 已完成，3–5 不足以淘汰機制。尚無足夠強度結論；不跳到 H9。
- H9-off 與 H1-off 都要各自從 accepted baseline 建獨立候選，不疊 visible-T 或前一個未證實改動。
- 其他參數已在 EVALUATOR_SEMANTICS_2026-09-28.md 全欄盤點，但尚未排定逐項 ablation 的完整次序。不得把清單順序當成已決定的實驗順序，也不得聲稱所有參數都已測完。
- 本次曾討論同批測多個獨立候選，並未形成新的已執行計畫；不據此覆蓋原有順序。
- 48 場草案未啟動；後續提出 100 seed blocks × seat swap = 200 場，同樣未啟動。效率調查完成後回到 visible-T 的固定樣本比較，先更新具體配置與成本，不照舊 48 場 JSON 誤發任務。

此表整理目前已取得的證據；不是已啟動的 arena，也不是自動調參授權。所有比較以固定 accepted baseline 為控制組，不能默默疊上前一個未證實改動。

| 順序 | 唯一改動 | 要回答的問題 | 現況與必要前置 |
|---|---|---|---|
| 1 | T-slot 額度換成 remaining known T + reserve T | 不預支未知 T 的完整 policy 是否更強？ | pilot run 36707273929 correctness 通過，KO 3–5；不 promotion、不以小樣本淘汰。較大固定樣本比較待效率插入工作完成；先不進 H9 |
| 2 | accepted profile 僅 H9 weight=0 | 洞穴連通性懲罰是否提供其他現有 features／search 之外的 KO 收益？ | 語意已清楚，不是 holes/coveredness 的同一 scalar；尚未建立獨立候選，不換成新 downstack feature |
| 3 | accepted profile 僅 H1 weight=0 | incoming 條件化盤面懲罰是否改善 KO 勝率？ | shared coefficients、cap16、低乾淨盤面零值已確認；不另加 cancel bonus，不改 cap/timing |

順序反映候選準備程度與已有證據，不代表已知道 feature 重要性排名。每次只前進一項；單項優劣與多項交互作用是不同問題，單項勝出也不自動累積成新 champion。

## 不再拖延的界線

語意盤點不能回答勝率，不能無限要求更多離線 witness。第一項 WASM／browser gate 已通過（run 36702845823），八局 correctness pilot 亦已完成（run 36707273929），不要重新執行已通過的前置工作。不得因本文件存在就一次排三組大量對戰。原使用者要求完成後 ntfy、不要持續盯跑，保持不變。

任何 arena 均沿用既有 snapshot-only、Tetrp referee、top-1 parity／zero fallback、24 frames cadence、shared piece seed／seat swap 與 technical failure 不計分的契約。檢驗強度只用 KO 結果；APP、H1/H9 項目值、風格只作 diagnostic。先鎖定相同 seeds／match protocol 與計算 budget；不能看完勝負再挑有利 seeds 或任意續跑到贏。

小型 pilot 只足以篩查技術問題和大幅退步，不能因贏一場 FT7 宣稱進步。後續比較總量需在實際 browser／arena 成本明確後固定；目前不虛構 power 或需要幾局的精度。通過測試的變體也保留獨立版本與證據，不直接取代 production。

## 本輪以外的項目

既有 inventory 的 clear shaping、wasted T、B2B Boolean、PC override、well、transitions、height 等仍保留。它們不是「已證明重要」；本輪沒有足夠 outcome evidence 判定無用，也不新增 TSD／mini／Hold bonus。不同 shared coefficient 的作用域已記錄，之後調參前須重看；不把本輪變成全參數 sweep。

## 2026-10-02 overnight fixed sample

User authorized the prepared visible-T fixed 200 single-KO games (100 new
seed pairs), using the verified native parallel two-match runtime. See
[bounded execution plan](VISIBLE_T_200_PLAN.md). Do not dispatch the old 48-game
draft, repeat performance pilots, queue H9/H1, promote automatically, or extend
sample size after seeing the score. H9-off then H1-off remain independent
future candidates; this run changes no evaluator weights.
