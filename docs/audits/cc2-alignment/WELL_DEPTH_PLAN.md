# 井深0／0.6：本輪最後兩個候選

2026-10-04使用者授權開始。先well-off=0，再queue well-double=0.6，以原accepted=0.3作控制。兩版只改tetris_well_depth，其餘回到原accepted：B2B clear=1、Boolean=.5、bank=0、三表原值、H1=1、H9=−.5。不是疊加任何先前最高分候選。

語意見[井深審查](WELL_DEPTH_REVIEW.md)。數的是T-slot cutout後最低欄頂端起、其餘9欄皆滿的連續列；不是承諾能用I兌現。候選只改係數，evaluator本體與gameplay不修改。

## Gate與執行

- 共用既有evaluator workflow，variant=well-off或well-double，編譯candidate使用`--cfg well_depth_candidate`，control不帶cfg。輸出配置必須只差井深係數；manifest.variant／planHash／binary SHA鎖定身分。artifact內部保留surge-residual檔名，不表示啟用Surge。
- Rust snapshot tests及well_depth_gate_tests：深度0/1/3/4/8、左中右、是否有I、Hold I/O、連續列中斷、底座、雙空欄、roof、T-slot cutout前後、terminal。完整evaluator leaf delta為(weight−.3)×depth，edge Reward不變。合成數值測試不是落點合法性證明。
- 固定原20 public snapshots（12perf＋8charged），frozen accepted與rebuilt control完整report一致；candidate top1／Hold／再分析／空非空Hold的authority parity。至少一份top1改變；不足即停止，不放寬或追加樣本到成功。此為井深假設，非charged限定activation。
- 各gate成功才200新candidate KO，重用run37026070707原accepted200控制。100共同seed blocks×兩座位；同局同piece seed，24frames/placement、200k nodes、PublicSnapshot-only、Tetrp唯一裁判、zero fallback/rejection/parity mismatch。KO-only，無一般frame cap；watchdog是技術異常，simultaneous KO整block換seed重打並披露。
- 先確認0版in_progress再dispatch0.6版，共同concurrency group，第二批pending不佔runner。即使第一批失敗，第二批仍須獨立過自己的gate。每批最多16runners×2局、每job90分鐘。完成或失敗ntfy just_a_kiwi_for_tetrp，不持續監看。

本機18項checks通過，0.6環境另跑8項通過。已核對整合installer在實際accepted source上產出的evaluator本體與離線準備相同、Rust模板無殘留、正確cfg；Rust與public gate由Actions驗證，不預先宣稱成功。

## 分析與停止規則

兩候選各自相對accepted，100seed clusters配對t近似95% CI；重用已知control及多候選探索，非多重校正的独立確認。相同seed可另報0.6-vs-0探索差，不據此宣稱最佳權重。無score-dependent追加，不自動promotion。

**測完此兩批立即停止本輪盤點，不自動接第6–12項。** 整理全部證據，再選一個具機制理由的強化方向，以新seed及預定採用標準確認。此run不啟動確認批或其他queue，production維持accepted。run ID另記dispatch。
