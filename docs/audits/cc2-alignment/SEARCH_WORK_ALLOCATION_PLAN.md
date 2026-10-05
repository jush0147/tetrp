# 固定預算工作分配：離線計數

2026-10-05 使用者「好，繼續」授權。目的是查 final trace 中不同候選的已知延續深度差如何產生，不先改 evaluator 或搜尋策略。依原使用者限制，正式分析時間不得增加；本次只有隔離診斷build會加計數。

## 已查 source

- snapshot可Hold時Place／Hold各100k；有10個scenario時各自每scenario10k，總request200k。不是每候選／每scenario200k。
- known.select用當下排序的index抽樣：`floor((-ln(U)/ln(2)) mod children.len())`，children多時前兩名約50%／25%。這不是依final rank保證分配，也沒有每個root相同展開量的契約。
- DAG沿途可能走到Speculated層；finite_visible時不展開，回傳Failed。已展開但無children的known節點也可Failed。空轉不增加nodes，但有wall cost。
- analysis逐次do_work，累加節點；連續1024次zero-node或allocation用完即停。未完成parent expansion依原契約取消，已評節點仍計費。
- 這些是設計機制，不是已量出的瓶頸，更不是已證明的KO失分原因。

## 新增資料

沿用4個frozen snapshots與final-score workflow，加入插入式cfg observer：

1. 每次do_work最後到達depth、是否known層、是否取得待展開node、第一層實際選的placement與當下rank。
2. 按selected root／depth／reason彙總attempts、nodes、expansions、partial cancel；不保存每次event的大型log。
3. reason包括expanded、selected_zero_nodes（含terminal）、finite_frontier、known_failed、partial_cancel。known_failed不假裝已細分terminal和expanding collision。
4. 每allocation原budget、總nodes/selections/expansions、max/final stall、停止原因。計數必須與原Statistics精確相等，總nodes與正式report相等。
5. 保留原646條final路徑與top2歸因gate，對照同root最後的深度、當下rank分配與已花節點。

DAG共享後代：root work只指本次selection走哪條root進入，不是該root獨享的所有資訊或收益。rank histogram是選取當下的rank，不是最終排名。zero-node嘗試比例不是wall-time比例；沒有profile不能宣稱節省多少秒。

## 驗證與停止點

9項本機tests及4個actual source插入還原檢查通過。無本機Rust；單job編譯、observer-off/on與accepted WASM完整report parity、score reconstruction與work accounting，成功或失敗ntfy `just_a_kiwi_for_tetrp`。不監看、不接arena。

本輪不調exploitation、不均分root budget、不強迫補深、不加node budget、不重啟tail；未提出candidate。結果先區分搜尋覆蓋與空轉／取消成本，再決定是否有一個可測、且線上時間不退步的修改。沒有依據就不為了繼續而換方向。
