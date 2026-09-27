# Spawn movegen：先量測集合差異

本輪不修改CC2 movegen、search或evaluator。固定 upstream `2e243242b674d57491f99b445f75e35fc48a0e26`，真正編譯並呼叫 `find_moves_with_clutch`；四項forecast修正不影響此函式，本輪使用原始pinned source。

## Fixture與比較單位

- 7種piece × empty、既有T-spin fixture的board重新spawn、固定overhang，共21例。
- I/O/T各測spawn obstruction，有／無前手clear的clutch，共6例。
- 共27例；只傳公開board、current+NEXT5、Hold、rules、公開clear條件。既有fixture僅作board樣本，不傳raw replay或future。
- 第一層比較occupied cells集合；第二層比較cells+spin集合。CC2 canonical rotation與Tetrp代表姿態可能不同，不能以raw x/y/rotation不同誤報geometry差異。
- 每個authority landing保存action、逐步provenance、clear，全部經`validatePlacement`重播。輸出CC2獨有placement與authority獨有witness，後續逐例判讀。

Authority列舉直接呼叫PlacementArenaEngine的move/rotate/descend/slam，沒有用Native evaluator或movegen。保留fractional y、kick、rotated、spin、totalRotations直到lockresets+16桶；超過kickY門檻後合併。Key中y用6位小數消除數值累積雜訊；本輪起點17.96及kick .1皆遠離ceil／raw-ceiling的整數邊界。hy/resets影響timing但不影響此atomic placement幾何，不作key。每例上限250000 states，超限直接technical failure，不拿partial集合比較。

## 邊界與驗收

這輪是spawn-based深層movegen診斷；不是任意current pose、Hold lifecycle、後續spawn/clutch KO、physical transport或strength驗收。也不宣稱窮盡所有board形狀。cc2-only暫指沒有在此authority列舉集合找到相同cells+spin，需要檢查witness與表示法後才判定規則原因。

Actions完成代表diagnostic完成，允許輸出實際集合差異；編譯、輸入格式、certificate、state budget或driver錯誤則失敗。Artifact包含PublicSnapshots、所有authority witnesses、Rust placements、集合差異、source hash、pinned commit及Rust版本。完成／失敗使用既有ntfy topic通知，不盯場。

本機27例authority列舉完成，所有輸出landings均有authority certificate；3項targeted tests通過（empty O九個落點、預算失敗不可當空集合、cells合併但spin不可合併）。Rust結果待Actions。

接著依真實difference witness一次修一類geometry／provenance問題，維持CC2 DAG路線；不因source表達式不同就先改、不開FT7。
