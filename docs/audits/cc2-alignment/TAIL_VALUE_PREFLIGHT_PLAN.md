# 一層未知tail：實驗實作與離線preflight

## 2026-10-05 bounded-v2（優先於下方 v1 描述）

使用者授權繼續修正 run 37291859932 的預算／publication 問題。仍僅一個離線 job，無 arena、無 production 改動、無參數調整。

- 每個 Place／Hold／garbage scenario allocation 各自最多 20% 用於 tail transitions，總 request 仍 200k。20% 是工程保護上限，未宣稱最佳。
- 先枚舉七種 piece 的合法動作，算出完整 probe transition cost；整組放不下就不做 transition、保留 V0。movegen 仍有 wall cost，不算零成本。
- admission 同時保留當前 parent 剩餘 known-piece siblings 的普通 transition 預算。完整 probe 必須隨完整 parent 提交；gate 要求 completed == published。
- 新增 shadow：相同 admission／quota／probe 工作，但提交舊 Eval。candidate 提交新 Eval。兩者分數不同後，搜尋路徑與實際成本仍可能分歧，不能稱完全相同搜尋軌跡。
- 比較 accepted→shadow、accepted→candidate、shadow→candidate；frozen accepted 與 rebuilt control 的完整 report 仍須一致。
- 固定 20 PublicSnapshots，candidate 與 shadow 都驗證 authority top-1；若 Hold 則實際 Hold 後重新分析並驗 placement。保存兩者完整 reports、post-Hold snapshot、proof、actual、timings、per-allocation budget/quota/spent。
- 三個 binary 都跑 Rust snapshot tests／tail tests。gate 要求每 allocation spent ≤ floor(budget/5)、總 transitions ≤ 40k、所有 work 仍在 200k 內、completed == published。

本機 JS／真實 accepted source 錨點檢查完成；本機無 Rust，編譯與執行 gate 交 Actions。hypothetical probe 的完整逐 transaction authority parity、browser cost 仍未完成。成功也不自動開 arena，ntfy 後等使用者回來驗收。

## v1 歷史記錄

2026-10-05 使用者「好，試試看」授權。依EVALUATOR_REDESIGN_REVIEW_2026-10-05.md，先小型實驗，不開arena。production、accepted參數與Engine皆不改。

## 實作範圍

`kiwi-tail-value-prepare.js`只植入隔離的pinned CC2 source，原evaluator SHA必須為`9fe27a686c21515eb729af2ec73c4b99cd0ad6201b783fd35319a93c265f03d1`。candidate以`--cfg tail_value_candidate`啟用，control關閉；不是Native Kiwi v0。

當node.depth等於該snapshot branch的normalized known queue length，在既有最後一個known placement之後計算七種等權piece、每種合法下一手最大(R0+V0)，平均取代該leaf Eval。prefix reward保留一次；probe只調原evaluate，不遞迴呼叫自己。死亡/沒有合法動作仍佔1/7，不忽略。

空Hold時normalized reserve是current，必须先驗它的spawn；occupied Hold則先驗假設current，再考慮reserve。只在未來單手情境內使用假設piece，不送進目前root action或private Engine，不讀真實queue、piece history或bag remainder。probe前後bag顯式設成all；因此終點V0不採用由假設piece推導出的bag殘餘。這是明示的實驗設定，不是七袋條件機率。

200k request總預算不變，probe每次transition都計入new_stats.nodes；7種全算完才使用值。若中途預算不足，取消整個尚未完成的parent expansion並停止該allocation，保留DAG既有值，已做工作仍計費。這比「個別probe回退V0後繼續」更保守，遵守既有不可publish部分children契約；可能造成已完成probe也被丟棄，必須實際量測。

統計calls/completed/published/incomplete/transitions；published只指parent expansion完整提交，不等於unique TT節點或root最優continuation。初版無額外probe快取，不能假設零成本。每個report加`value_model=experimental-iid-one-step-frontier`及`_tailProbe`，base unknown_tail=finite_visible描述輸入known-prefix搜尋契約；不可脫離value_model將candidate報成完全無hypothetical tail估值。

known_depth只服務stateless snapshot experimental binary，不提供TBP advance/new_piece功能或上線WASM。

## 單job驗證

workflow `kiwi-tail-value-preflight.yml`，40min、一個runner、沒有arena jobs；push只註冊且jobs跳過。原source與final patch同accepted；編譯control/candidate，兩者跑snapshot tests、tail_value_tests。

Rust property tests涵蓋empty/occupied Hold、budget=0／exact／少1、bag不影響七種假設、封頂spawn不能靠Hold救活。這不是完整Tetrp逐probe交易對照，不得誇大。

固定原12 perf＋8 charged public snapshots，每份先比較frozen accepted與重建control的完整report（只去掉新增metadata），再跑candidate。核對200k cap、unknown bag、published與transition計數；candidate top-1在Tetrp path/provenance與lock frame驗證，Hold後重新分析。保存snapshot/report/action/proof/actual與wall ms。

本次只量activation、root correctness及native executable成本，不是browser latency、完整hypothetical transition parity或強度證據。若編譯失敗或gate不過，artifact+ntfy通知，不能開arena。若成功也不自動開arena；先看coverage／published／top1影響／wall cost，必要的逐probe authority fixtures和瀏覽器效能尚須補齊。

## 停止點

不可為讓candidate活躍而自動提高budget／tail深度／調weights。若parent取消導致沒有有效published probe或成本不可接受，報告此實作結果，不能把只完成但丟掉的計算當策略改善。若20 snapshots未改top1，亦不宣稱全體state永遠無效；本輪不派strength測試。

本機沒有Rust；source-transform實際accepted錨點與JS契約檢查通過，Rust語意與Linux20snap gate待Actions。完成/失敗通知`just_a_kiwi_for_tetrp`，不持續盯跑。
