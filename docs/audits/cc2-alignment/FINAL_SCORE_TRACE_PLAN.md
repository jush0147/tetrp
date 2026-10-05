# 最終 root 分數歸因：離線診斷

2026-10-05 使用者「繼續」授權。承接 EXISTING_SCORE_AUDIT_2026-10-05：現有取樣缺最終最佳延續，不先改 evaluator。

## 限定工作

- 原 accepted source／final patch／review_h9_h12，原四個 PublicSnapshot、200k request cap，無 tail extension、無新權重、無 arena。
- 每個 scenario 搜尋完成後，唯讀遍歷已存在 DAG；沿 root 指定 edge 後每層取 children[0]。禁止 select／expand／insert／強制初始化 Lazy layer。
- 保存每個root的final chain，之後按正式跨scenario平均排序找回全局top2。特別是Hold：必須追蹤同一個跨scenario最佳假想placement，不能逐scenario挑不同最優placement再平均。
- 只為描述保存路徑，以原 GameState.advance/evaluate 重播每條已有edge，不生成新動作、不擴展節點。softdrop權重必須0；診斷重算距離0與cached Reward bitwise核對。
- 每個edge檢查 childValue+Reward（f32原順序）等於cachedScore；內部node值等於best child；由末端反向累加精確重建root。Speculated層只可讀未展開leaf，未知piece不得被執行。
- 保留12階段累積Eval/Reward、真实／cutout board、spin/clear/combo/B2B、pending/sent before/after。末端分清未展開heuristic leaf、已展開無合法child死亡，不能拿普通board Eval解釋後者。
- JS再核對路徑f32加總、leaf值、各scenario平均／worst與原analysis候選分數、全局top2。

## 不增加線上成本

所有植入只在隔離 `.cache/cc2-wasm-source` 的診斷build；DAG讀取與observer module以cfg限定。未修改production vendor、accepted binary、weights、節點預算。原evaluate算式移除新增區塊後需逐字還原。

讀出所有root chain是為避免遺失跨scenario平均後的真正top2，僅四個離線request。重播／記錄有診斷成本，絕不宣稱零wall成本或把診斷latency當線上benchmark。搜尋期间不保存大量節點，vectors只在路徑重播時填入。

## 驗證與交付

本機7項測試通過（含錯誤cached score／reward／leaf拒絕、Hold跨scenario組合反例、provenance），真實accepted freestyle插入檢查通過。無本機Rust；單一Actions job上跑observer-off及on，完整report必須與accepted WASM一致，再驗score trace。

25分鐘watchdog只防diagnostic job卡死，沒有對戰frame cap。完成或失敗ntfy `just_a_kiwi_for_tetrp`，不監看、不自動開arena。通過後才分析top2分差；不能因有精確分數分解就宣稱某動作KO勝率較高。
