# Failed insertion：獨立交易順序修正

以已驗收 timing + queue-scan + storage 為對照，候選只將 packet 扣款／移除移至 board 成功插入之後。保留既有 top-row rejection、cap、clock、cancellation、topped_out 行為，不改 evaluator 或 production。

驗收要求：

- 原72個 placement fixtures 與兩邊 cases 相同，comparisons 完全不變且零差異。
- 另6個 primitive boundaries：full row 在storage頂端／第二／第三行，分別成功0／1／2行後拒絕；每種再測單packet及inactive隊首＋多active packets。
- Tetrp 真正 `tank` + `pushLine` 產出 oracle；Rust 真正 `Forecast::resolve` 輸出 cols、garbageRows、pending amt/ready/hole、tanked、blocked。
- 對照必須重現每次拒絕多扣1行的精確pending差異；候選6例必須全部等於oracle。不得只驗remaining總和。
- Rust確認terminal之後再次resolve不變；原有跨兩手、clock、queue及storage tests繼續跑。

Full-row fixture是交易primitive的故意失敗邊界，不宣稱普通decision snapshot可保留未清full row，不當成spawn／KO驗證。Rust既有storage characterization在候選改為pending保留斷言；對照仍驗已知bug。

本機已生成6個authority案例、4項targeted tests通過、JS syntax及四份patch依序apply-check通過。Rust compilation／paired gate交由Actions；ntfy通知。下一步仍為movegen／spin provenance、Hold、spawn／clutch審查，尚不開FT7。
