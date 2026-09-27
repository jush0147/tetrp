# 完整逐格 movegen 的成本剖析

前輪correctness candidate在39例全等authority，但native kernel中位倍率26.77×。此輪先收集展開證據，不先恢復任何幾何剪枝，也不將未量測的空中狀態成本當成已知瓶頸。

同runner、同39個fixtures，兩個build：

1. Reference：pinned source + mid-descent.patch。沒有計數器；沿用7批×25次latency samples。
2. Profile：相同source另加唯讀計數，driver以`--cfg cc2_profile`取得結果；停用全部timing repetitions，不將instrumented latency當作效能數據。

計數包含queue pop、非stale展開、above_stack展開、grounded展開、下降距離總和、max queue、unique visited、回傳landings。Airborne由expanded-grounded推得。`above_stack`是各column的局部高度關係，包含部分grounded情況，**不是安全剪枝證明**。下降距離總和不是CPU指令數或drop_distance函式內迴圈次數。這是工作量計數，不能冒充各函式wall-time flamegraph。

Gate要求兩build的每個placement、cells、spin、soft-drop cost完全相同，且39例都與authority集合一致。計數不能改動policy／規則；source before/after hash與combined instrumentation diff保存。原有相對Legacy的294筆cost差異仍未處理，這輪不變動其語意。

收到結果後依實際工作量決定第一個壓縮範圍；所有候選仍須同時對照逐格reference與authority。保持placement模型，無physical input timing要求，不接production、不開FT7。Actions完成／失敗ntfy通知，不盯場。
