# Evaluator 全項目環境語意審查：第一輪

2026-09-28 開始，2026-09-29 完成此輪。依 [固定計畫](EVALUATOR_ALIGNMENT_PLAN.md)，不調權重、不新增 feature、不開強度對戰。

## 做到哪裡

已對 accepted source 的 Rust `Weights` struct 與有效設定檔逐欄交叉檢查：**32 個欄位、展開陣列後 42 個數值位置及 2 個 bool**。42 包含未生效項目與整數上限，不代表 42 個可獨立調整的權重。每個欄位均有分類，無漏項／重複。

另直接執行 Tetrp `resolveAttack` 的 9 個條件交易例子。它們測交易語意，不證明該輸入一定來自可達盤面，也不是 Rust vs JS 的完整 parity 測試。Rust evaluator 的解讀來自 accepted source，不假裝已在本機編譯執行 Rust。

重現：`node scripts/kiwi-evaluator-semantics.js`。需要本地 `.cache/cc2-parameter-audit/src/bot/freestyle.rs`，它由 pinned Git source 加 accepted artifact patch 重建。輸出 [evaluator-semantic-evidence.json](evaluator-semantic-evidence.json)，含欄位定義行號、source SHA-256、每個案例完整輸入及 authority 輸出。

## 全部項目的處理判定

以下「近似」是它真正在做的事，不是「已證明不好」。所有項目的勝率重要性目前都未由本輪建立。

| 機制／欄位 | 計算與環境的關係 | 現階段處理 |
|---|---|---|
| useful_attack_reward | scenario 內 forecast.sent 增量；不是 raw generated | 定義適合送出量，保留。仍依賴 forecast 的支援域，不把 scenario sent 當真實 future |
| cancellation_reward | 僅有 clear 時的 pending 減少，避免把 tank 當 cancel；目前 0 | 計量可解釋；不啟用、不宣告没用。opener 可使 cancel 超過 generated，見案例 |
| normal_clears / mini_spin_clears / spin_clears | 額外 clear 類型偏好，不跟 multiplier、pending 動態變化 | 明確標 shaping，不能拿它與 authority attack 不同就報 bug；有效性待驗 |
| back_to_back_clear / combo_attack | normal B2B bonus flag 與舊離散 combo 分數 | 與精確 attack 有交集，屬 shaping。不能描述成完整 B2B/Surge/combo transaction |
| perfect_clear / perfect_clear_override | 空盤加 15；覆蓋的是 legacy clear/B2B/combo，不是 H2、wasted-T 或 leaf | 不依 rules.allclears 切換；若解釋為「AC attack」就不對，若是空盤資產則仍是待驗 proxy |
| wasted_t | T 且非「full spin、至少 2 行」就扣分 | TSS 也會扣，不是只處罰沒 spin。沒有比較可見替代用法；屬策略偏好，不是規則 |
| has_back_to_back | leaf 是否持有 +0.5 | Boolean proxy；不隨 charge／兌現能力變。不是規則算錯 |
| h3_b2b_charge_value / h3_surge_bank_value | 用 public charging rules 算 progress/bank，但權重 0 | 不啟用；不能說模型完全沒 Surge（transition 已算釋放） |
| pending_safety | 真實 post-transition board 的穴洞／覆蓋／高危，乘 min(pending,16)/8 | 明確的 quantity-only 風險假設，沒有時間折減；與基礎 board 項耦合 |
| holes / cell_coveredness / max_cell_covered_height | base 用 T-slot cutout 後盤面；H1 用真實盤面，兩者共享係數與覆蓋上限 6 | 記錄雙用途。不能直接改 holes 就宣稱只改靜態盤面安全 |
| h6_base_holes_scale / h6_base_coveredness_scale | 只縮放 base，沒有縮放 H1 | 未來隔離機制時應利用這個區別；目前均 1，不改 |
| height / height_upper_half / height_upper_quarter | base 用 cutout 後 max height；10/15 以上額外懲罰，後兩項也進 H1 | 對 20 行可視高度的風險 proxy，不是實際 spawn/clutch 死活判定 |
| row_transitions | cutout 後橫向占格轉換，含牆；沒有操作可達性資訊 | 幾何 proxy，保留待驗。64-bit 邊界也包含常數項，不以絕對分數判危險 |
| tetris_well_depth | cutout 後最低欄旁邊完整列的連續深度 | 未檢查可見 I、到達路徑與消行時機；資源近似，不是已完成攻擊 |
| h9_cavity_excavation | 真實盤面空區塊的最少垂直 blocker | 不等於實際最低 downstack 成本；與 holes/coverage 部分重疊，不能僅凭相關性刪除 |
| tslot | synthetic bag / reserve 決定模板使用次數；假想消行會改其他 leaf 指標 | **優先深入**：資料語意及跨項影響尚未和 snapshot-only 資源定義對準 |
| softdrop | 目前 0；root authority allowlist 給的成本也是 0 | 零值符合目前 atomic placement 不評按鍵成本的實驗。不能直接恢復舊值，root/deep 成本來源不同 |
| tetrio_s2 | evaluator 分支開關，目前 false | 不是 gameplay 開關。保持 false，不能用「開 TL」理由改它 |
| attack_reward / surge_value / b2b_charge_value / legacy_shape_value | 上述 inactive 分支內的舊參數 | 排除現行有效性分析；若未來啟用要另外審查 default Surge rules、multiplier、H2 疊加 |

## Authority 交易例子：用來校正名稱與解讀

所有 TSD 例子均初始 combo=0、btb=0，非 AC；沒有自行重做 TL attack 公式。

| 例子 | generated | cancelled | sent | 舊 full-spin-double shaping |
|---|---:|---:|---:|---:|
| 無 pending，opener 外 | 4 | 0 | 4 | +4 |
| pending=4，opener 外 | 4 | 4 | 0 | +4 |
| pending=8，opener 內 | 4 | 8 | 0 | +4 |
| multiplier=2，無 pending | 8 | 0 | 8 | +4 |
| 消到 garbage row，無 pending | 5 | 0 | 5 | +4 |

最後一欄是 source 中的固定 lookup，不是完整 evaluator 輸出。H2 加 sent；H1/board 等仍會改結果，不能由此表推論完整候選排序。

這些差異不是要求 shaping 等於 attack，而是明確顯示：**sent、cancel、clear-shaping 是不同概念**。例如用 generated 推算 cancel 會漏掉 opener 加成；用固定 spin 表描述收益會漏掉 multiplier 與垃圾 bonus。

其他例子：

- 普通 double AC：allclears=true 時送 6，false 時送 1；legacy PC 項都會是 +15。這不證明 +15 錯，但證明它不能被命名為「依 rules 給的 AC 攻擊價值」。
- 普通 single：raw btb=8 時釋放 Surge、送 4，btb=0 時送 0；legacy single 表都是 -2，實際 Surge 差別由 H2 補入，且 live-B2B leaf 會消失。不能把所有 break B2B 都判成浪費。

## T-slot 已確認的語意鏈，及尚缺的證據

1. `Randomizer::Unknown` 初始化 synthetic bag=全部七種。
2. 模擬 advance 仍會 remove(next)，空了 reset。它不是從公開資訊證明的真實 bag remainder。
3. cutout 次數 = contains(T) + reserve==T + bag.len<=3。empty-Hold 正規化時 reserve 代表 active current，不一定是 Hold。
4. 模板只看 board 幾何；沒有提交合法 placement/spin certificate。
5. 若假想消超過 1 行，局部 evaluate 副本的 board 被替換。base holes/coverage/height/transitions/well 都改在此盤面計算；H1、H9 先前已用真實盤面。
6. 真正 search child state 不被這個局部副本改寫，因此不是 authority teleport 或 child-board corruption。

確認的是「假設藏在不只一個 bonus 裡」，不是勝率損失。尚需真實 continuation 中的 cutout 前後分項、使用次數、known remaining queue／Hold lineage，才能判斷影響頻率與哪些 action 受益。即使 frontier 沒有已知 T，也不能推論未來 T 機率為零，因此不直接把它替換成硬性 visible-T count。

## 目前不能聲稱的事

- 不知道哪些機制對勝率最重要或沒用；未做 ablation。
- 確認係數共享，不等於確認重複懲罰有害。
- 未列入的 explicit hold-flexibility、兌現時間、未來 opponent pressure 等，只能列為潛在缺項。搜尋、合法動作集合與現有特徵可能已間接反映部分效果，不能直接加 feature。
- 沒找到本輪足以直接改 production evaluator 的新 supported-rule transaction bug。ARE 支援限制仍是另外的問題。

## 下一項執行工作

先加入 **accepted Rust evaluator 的隔離診斷**，只記錄各階段 board 和分項，不改 evaluate 公式、排名、node budget。確認 diagnostic-off artifact 與 baseline 行為一致後，針對固定少量真實 snapshots 看 T-slot/coupled features 的計算。這是語意取證，不是 tuning 或 arena。

完成這項取證後，再逐項給「需修正」或「可解釋近似、有效性待驗」的最終處理建議；不因本表存在就開始參數掃描。
