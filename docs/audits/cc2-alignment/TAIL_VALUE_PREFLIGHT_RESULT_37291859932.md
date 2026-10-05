# Tail value preflight：執行通過，預算／publication 尚不適合arena

2026-10-05。[run37291859932](https://github.com/jush0147/tetrp/actions/runs/37291859932)，source `3a5ed32cb460f046f1ebaf23a421750972318ee3`。單job成功，無KO對局，不能判斷強度。

## 正確性驗收

- 原workflow Rust snapshot tests及tail_value_tests成功；20 frozen accepted/control完整report parity成功（僅剝除新增metadata）。
- 20 candidate top-1 placement certificates／authority locks與9次Hold正常；本次另外在本機重建20份public state，以記錄中的action重做Hold/再分析snapshot對照、certificate及lock commit，結果與artifact完全一致。
- 每個initial request 200000 nodes，probe transitions包含在內；各report明示experimental-iid-one-step-frontier。
- source/hash/snapshot集合、summary計數與輸出binary核對通過。完整逐probe假設交易與browser latency gate尚未完成，不得將root parity當作整個新search model已證明正確。

## 實際發現

僅統計20個initial requests，after-Hold requests不混進同一分母：

| 項目 | 數值 |
|---|---:|
| 總node預算 | 4000000 |
| probe transitions | 3762943（94.0736%） |
| 非probe nodes | 237057（5.9264%） |
| probe calls | 12603 |
| 七種piece完整算完 | 12461 |
| 隨完整parent expansion提交 | 8613（completed的69.1197%） |
| probe本身未完成 | 142 |
| completed但未提交 | 3848 |
| top-1不同 | 4/20 |

published計數不是unique TT states，也不是root最佳延續使用數；不能聲稱8613個全部有用。未提交的3848是probe數而非transition數，不能把30.88%直接稱浪費算力比例。

四個top-1變動state：

| Public state | published probes | 可做的歸因 |
|---|---:|---|
| leg0/request138 | 410 | 有新值提交，但仍與budget重分配混合，未隔離value效應 |
| leg4/request167 | 0 | 沒有新值提交；不能歸功於tail value，變化由budget/截斷影響 |
| leg20/request493 | 0 | 同上 |
| b0-l3-charged31 | 639 | 有新值提交，但仍與budget重分配混合 |

另leg4/request670與leg12/request153也published=0，但top-1未變。總共4/20局面算了probe卻沒有任何probe值提交。

因為現在把每個frontier child的七種單手probe塞在parent expansion裡，完成整個parent所需成本大；當scenario／Place-Hold各自分到的budget不足，整個parent會取消。這避免partial-child correctness問題，但計算過的值可能全部丟掉，同時主搜尋的可展開量減少。這是本實作的排程／成本障礙，不是tail value理論已證明無用，也不是KO輸了。

## 時間數據的限制

同一runner、固定順序、各snapshot單次量測median：frozen accepted648.1ms、rebuilt control663.3ms、candidate500.8ms。candidate較快不能當更有效率或更強的證據：工作組成已大幅不同，便宜probe transition取代大量DAG工作。此資料不是browser、暖機平衡benchmark，也沒有證明在相同200k下搜尋品質相等。

## 決定

**此版不開arena，不promotion，不自動提高200k、不加tail depth、不調weights。** 先處理probe計算與parent原子提交的成本問題，並隔離「套用新值」與「僅改變算力分配」的效果，才有理由做強度測試。

後續仍是同一tail-value假設的工程檢查，不能直接跳成原版CC2權重或再開別的參數掃描。原版CC2配置baseline僅討論，未派送。完整hypothetical transition parity與browser gate也仍待辦；本次沒有新增任務。

## 身分

audit.json SHA256 `227f973d5526be0799cc40b665ffd9fc8c8e46890b202e2ea8aafe9851be3899`。

- accepted `386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb`
- rebuilt control `b51b8ad5ec569306a2352bc888a523614f58df2394c9f364fd1cd07a583633a2`
- candidate `18fb12e87a4ef02db3aa50ae5a92987bc1c86f47df0bcd37fee99c100dacdfab`

機器驗收表與各state intent見同名JSON；原全量report、proof、actual、binary在run artifact `kiwi-tail-value-preflight`。
