# H9：洞穴連通性，不是合法 downstack 成本

Accepted `review_h9_h12` 的 `h9_cavity_excavation=-0.5`。本輪沒有改 bot 或搜尋參數；重現脚本 `scripts/kiwi-h9-semantics-audit.js`，證據 `H9_SEMANTIC_EVIDENCE.json`。

## 計算語意與實測核對

H9 使用真實 post-transition board（T-slot cutout 之前）。在最高 occupied cell 以下，把空格依上下左右分成連通區；每區取「區內各空格正上方 occupied cells 數量」的最小值，再加總，乘 -0.5。

這是單格空間的連通性與垂直阻擋數 proxy，不是最少按鍵、最少 placements、最少消行或最少時間。原始名稱中的 excavation 不能解讀成 authority-certified downstack cost。不同區域的阻擋也可能由同一次消行一併移除，加總不保證是 gameplay 成本的 lower bound。

既存 Rust witnesses 全部重現：729＋371＝1,100 筆；最大分項浮點差 2.39e−7。兩批分別有 502、212 筆 H9 非零；取樣有 quota 偏差，不能把比例當作一般對局頻率。

## 與 holes／coveredness 的區別

以下是小型合成盤面，columns 用 bottom-up occupancy bits；實際盤面完整列於 JSON。

| 局面 | height | holes | coveredness | H9 cost | H9 分數 |
|---|---:|---:|---:|---:|---:|
| 封閉單格洞：7,5,7,0… | 3 | 1 | 2 | 1 | -0.5 |
| 側面開口：7,7,5,0… | 3 | 1 | 2 | 0 | 0 |
| 封閉相連雙格洞：7,5,5,7,0… | 3 | 2 | 4 | 1 | -0.5 |

前兩局面有相同 holes／coveredness／max height，H9 不同：它不是這幾個 scalar 的重複。第三局面洞數與覆蓋程度加倍，H9 仍是一個連通區、一格最低阻擋：它也不是 hole area 懲罰。

但這不證明 H9 對完整 evaluator 提供獨立或有效資訊；前兩局面的 row transitions 等其他特徵可能同時不同。更不代表 -0.5 是最佳係數。

## Authority 可達性驗證

構造最底一列空、上方九格屋頂、右側一格開口的盤面。空間連通到天空，所以 H9=0，但 holes=9、coveredness=18。指定目標為左下角 cell (0,39)。

從七種方塊各自 fresh spawn，以既有 Tetrp authority 枚舉完整 atomic-placement 幾何與 spin provenance：

- I 有 1 個覆蓋目標的合法 landing；JSON 保存完整路徑 certificate。
- O/T/S/Z/J/L 各有合法 landing，但沒有任何一個覆蓋目標。
- 每種枚舉均正常完成，未撞 state budget；不把未完成搜尋當不可達證據。

初始「這個通道沒有方塊進得去」的測試假設被 I 的合法路徑推翻，已依 authority 修正結論。真正得到的是 **可達性依 piece 而異，H9 的零值沒有反映這個條件**。若公開 current/NEXT/Hold 沒有 I，不能僅憑 H9=0 就視為立即可填；反過來也不能宣稱永遠無法挖開，後續 placements／clear 可能改變盤面。

這是固定盤面單手幾何測試，不是 24-frame 實體按鍵可達性，也不是完整多手 downstack 或存活證明。

## 成本與缺少的訊息

單次最多處理 10×40 空間，每個空格只進一次 flood fill，另做固定 64-bit popcount；Rust 每個連通區使用局部 Vec stack。這項比單純 column hole 統計多一層遍歷／配置，但本輪沒有 profiling，不能宣稱它是效能瓶頸。

它不讀 piece supply、Hold、SRS 路徑、garbage arrival 或攻擊回報，也不區分同 occupancy 的普通方塊與垃圾 provenance；這些訊息在其他 evaluator／transition 裡可能有部分反映，不能直接列成「bot 完全缺少」。直接量測合法多手 downstack 的成本高很多，這輪不新增該 evaluator。

## 決定

**保留為待驗證的連通性 proxy，沒有規則錯誤證據，不直接刪除或改權重。**

本輪已足夠回答它是否只是 holes／coveredness 的同一計算：不是。是否對 KO 勝率有幫助，必須固定其他項目做 H9 on/off，比較 complete policy；不需要先替它建立另一套深度規劃器。

T-slot、H1、H9 的局部語意取證到此收束。下一步依 MECHANISM_EXPERIMENT_PLAN.md 做可部署候選的工程準備；不再追加同類 observer，也不把所有 feature 都一次拿掉。
