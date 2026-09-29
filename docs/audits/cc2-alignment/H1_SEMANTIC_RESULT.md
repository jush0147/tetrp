# H1 pending-safety：有效係數與 cancellation 語意

分析 accepted `review_h9_h12`，沒有改權重、policy、搜尋或 authority。重現腳本：`scripts/kiwi-h1-semantics-audit.js`；逐筆結果：`H1_SEMANTIC_EVIDENCE.json`。

## 真正算的是什麼

令 `P` 為此次 transition 完成後仍在 forecast 的 pending 行數，`h` 為真實 post-transition board 的最高高度：

```
D = 1.5 × holes + 0.2 × coveredness
    + 1.5 × max(h − 10, 0) + 5 × max(h − 15, 0)
H1 = −min(P,16)/8 × D
```

coveredness 對每個 hole 累計 `min(column_height − hole_y,6)`，不是單純計算上方 occupied cells 的數量。H1 不含普通 `height=-0.4`、transitions、well 或 H9。它是 leaf state 的壓力條件化懲罰，**不是每抵銷一行就累積一次 reward**。

以既存兩次 Rust observer 的全部保留樣本核對：729＋371＝1,100 筆全部重現，最大數值差約 9.54e−8（Rust f32／JS 算術差異）。這不是 1,100 個獨立對局，也不是完整 evaluator 的重新實作。

## 與基本盤面項目的重疊

在 T-slot 沒有改寫盤面、base scales 都是目前的 1 時：

| pending | H1 壓力倍率 | holes 合計係數 | coveredness 合計係數 | >10 高度額外係數 | >15 高度再加係數 |
|---:|---:|---:|---:|---:|---:|
| 0 | 0 | -1.5 | -0.2 | -1.5 | -5 |
| 4 | 0.5 | -2.25 | -0.3 | -2.25 | -7.5 |
| 8 | 1 | -3 | -0.4 | -3 | -10 |
| 16+ | 2 | -4.5 | -0.6 | -4.5 | -15 |

普通 height 的 -0.4 不隨 pending 放大；表中兩個高度額外項按各自門檻累加。

所以 H1 的確重用部分相同特徵，但其作用是「有 incoming 時改變有效權重」，不是完全相同的常數重複項。是否需要這個倍率必須由機制 ablation 決定。也要注意：調 `holes` 或 `cell_coveredness` 會同時改 base 與 H1；調 H6 base scale 只改 base，兩者不是等價調參。

如果 T-slot 改寫了 evaluator board，base 用假想盤面，H1 用真實盤面，就不能再用上表合併係數。H1 此時部分抵消過於樂觀的假想盤面，直接移除它可能同時放大 T-slot 的影響。

## cancellation 是否已經有價值

**有，但不是固定每行價值。** explicit `cancellation_reward=0`；抵銷仍能降低 H1，並使後續 transition 少接垃圾，進而影響盤面與生死。

取既存真實節點（leg20/request493 的保留 sample 0）固定盤面：height=5、holes=3、coveredness=12，因此 D=6.9。以下使用真正 `src/attack.js` 交易，固定盤面只為分離 H1 壓力效果，不是完整落子比較：

| 交易條件 | generated | cancelled | sent | pending 前→後 | 固定盤面 H1 改善 | 直接 H2 reward |
|---|---:|---:|---:|---:|---:|---:|
| TSD，無 incoming | 4 | 0 | 4 | 0→0 | 0 | +4 |
| TSD，4 incoming | 4 | 4 | 0 | 4→0 | +3.45 | 0 |
| TSD，8 incoming | 4 | 4 | 0 | 8→4 | +3.45 | 0 |
| TSD，20 incoming | 4 | 4 | 0 | 20→16 | 0 | 0 |
| opener 防守條件成立，8 incoming | 4 | 8 | 0 | 8→0 | +6.9 | 0 |

這些數字不包含原有 clear shaping、B2B、combo、T 使用代價或清行後幾何改善，不能當作 total evaluation。低於封頂時，固定盤面每少一行 pending 的 H1 改善約 D/8；D=0 時改善為零。

兩個已證實限制：

1. 高度不超過 10、無 hole／coveredness 的乾淨盤面，即使有 16 行 incoming，H1 仍是零。這不代表 bot 整體認定安全：已知垃圾若在 horizon 內進場，forecast 與後續 board/terminal 評估仍可能看見危險。
2. pending=20→16 的 cancellation 對 H1 沒效果，因為上限16。future forecast 的差異仍存在，不能把這個局部平坦區直接判成 root decision bug。

## timing、blocking 與接垃圾

- H1 只讀 remaining 行數，不直接區別 ready now、延後到達或 unknown activation。forecast 會依各 scenario 的 timing 決定何時 tank，因此完整搜尋不是沒有 timing；但若剩餘行數與 board 相同，H1 自己不估 urgency。
- 未 active 的公開 pending 一樣可被 authority cancellation；已用 actual transaction 驗證，不應只把 active packet 當可抵銷資源。
- 普通 single 可在 generated=0、cancelled=0 時 block 本次 tank。這個延緩價值由 transition／後續搜尋表達，H1 並沒有獨立 blocking bonus。
- Tank 也會減少 remaining，使 H1 變小，但這不是 cancellation。`useful_attack_delta` 在 no-clear transition 回傳 (0,0)，不把 tank 的 queue 減少誤算成直接 cancellation reward。

具體 authority tank witness：上述盤面接 4 行、固定假設洞位2，pending 4→0，cancelled=0；height 5→9、holes 3→7。H1 從 -3.45→0，但只計 base holes/coveredness/height 的分數已從 -8.9→-21.1。不能只看 H1 改善就說接垃圾有利。此例只驗證 authority packet debit／board insertion，沒有 active-piece repair 或完整 evaluator 排名。

## 處理決定

目前找到的是 **有明確盲點的策略 proxy**，沒有找到需要立即修正的 H1 supported-rule transaction bug。

- 保留原值，記錄 pending cutoff、乾淨低盤面零值、leaf 無直接 urgency、真實／假想盤面差異及 shared coefficient coupling。
- 不新增 cancellation bonus；否則會同時改 offense/defense tradeoff，且可能與 legacy clear shaping、避免 tank 的搜尋價值重疊。
- 若進入機制驗證，第一個乾淨問題是「H1 on vs off，在其他 evaluator 與 T-slot 版本都固定時，有沒有增加 KO 勝率？」只用這個 ablation 回答整體條件化壓力項是否有用；不能同時改 cap、加 timing decay、加 cancel reward，亦不能由單次結果宣稱每個組成特徵都無用。
- 現階段不啟動 arena。依既定順序，下一項檢查 **H9 cavity excavation 與 holes／coveredness 的重疊和可達性語意**；完成後整理一張可執行的機制比較清單，不讓每個 proxy 都擴張成獨立研究平台。
