# 最終 score trace 驗收：分數可重建，未找到可直接改權重的證據

Run [37315205579](https://github.com/jush0147/tetrp/actions/runs/37315205579)，source `4994e5fadd450bfa7f0ae5e20f20c48684815b70`。單一離線 job success，約1分47秒，ntfy成功；沒有arena或production變更。

重現本次驗收：`node scripts/kiwi-score-trace-result.js`，讀 `.cache/score-trace-37315205579/`，輸出同名 JSON，包含來源hashes、PublicSnapshots、top2所有scenario的完整路徑與分項。

## 正確性

- 4個固定snapshot：observer-on／observer-off／accepted WASM的完整report一致，8次比較通過。
- 646條final root paths的cached child score、best-child value、末端反向f32累加與root score均通過；各scenario平均／worst與正式ranking一致。
- 本機重新執行全部上述JS artifact檢查通過，不只相信CI成功旗標。
- Hold以跨scenario選出的同一假想落點取值，沒有逐scenario改挑不同root placement來提高均分。
- 這是診斷分數正確性，沒有新增authority全規則或物理transport證明，更不是KO證據。

## 首選究竟怎麼贏過第二名

下表的sent為已搜尋路徑實際forecast newly sent總和；多scenario取平均。shaping是所有非sent edge reward的淨和；leaf包含board與資產估值。score約為sent+shaping+leaf，精確值按原f32反向累加。

| Snapshot／候選 | sent | shaping | leaf | score |
|---|---:|---:|---:|---:|
| leg0/request346：I west x2 y1 | 11 | +2 | −65 | −52 |
| 同局第二名：I east x2 y2 | 11 | +2 | −65 | −52 |
| leg4/request419：Hold | 6 | −1.5 | −81.9 | −77.4 |
| 同局第二名：Place T | 5 | −1.5 | −88.6 | −85.1 |
| leg12/request383：Place T | 7 | +0.5 | −64.4 | −56.9 |
| 同局第二名：Hold | 3 | −4 | −65.4 | −66.4 |
| leg20/request493：Place T | 6.4 | +0.6 | −68.06 | −61.06 |
| 同局第二名：Hold | 6.6 | +1.65 | −69.58 | −61.33 |

1. **leg0/request346**：兩種I orientation同分、同後續收益。最佳鏈看見Tetris送7、mini single送1、full-spin single送3，共11行；不是之前局部取樣看到的7行上限。Mini也沒有立刻被普通clear打斷B2B。此例不能用來支持「bot忽略攻擊」。
2. **leg4/request419**：Hold優勢約7.7分，其中+1來自sent、+6.7來自末端Eval，非sent shaping相抵。Hold鏈在第4手Tetris送5、第6手double送1；Place鏈到第6手才Tetris送5。兩者都走6手。此例是現有估值偏好攻擊和末端都較好的鏈，不是高攻branch被壓掉的證據。
3. **leg12/request383**：Place領先9.5，其中sent +4、shaping +4.5、leaf +1。先普通double，再Tetris，兩手送1+6；Hold鏈只送1+2。wasted-T總懲罰兩者皆−1.5，差別不是此項造成。仍只是目前搜尋找到的鏈，不證明全局最優。
4. **leg20/request493**：Hold的sent多.2、shaping多1.05，Reward合計領先1.25；Place的leaf領先約1.52，最後以約.27分勝出。這次可以精確說明是末端估值逆轉排序，但不能因此稱之錯誤，因為更多sent不等於更高KO勝率。

## 第四局的末端分差

Place minus Hold leaf差約+1.52，主要分項：holes +.9、coveredness +.66、transitions +.4、well +.27、H9 +.2；相反的B2B Boolean −.25、T-slot直接bonus −.5、height −.16。H1末端兩者皆0。分项的微小殘差來自f32累加。

這不是單一weight壓倒其他分數；T-slot cutout還可能改寫末端評估盤面，因此holes等不能全稱為真實盤面安全的差異。不能用此表直接推導應調哪個係數。

## 新確認的限制：同一候選的各情境比較深度不同

前三個snapshot的top2鏈都是6手。第四局Place各scenario均6手；Hold在scenario3／4／8分別只到4／3／5手，其餘6手。都是未展開heuristic leaf，不是已證明死亡。

| scenario | Place深度 | Hold深度 | Place分數 | Hold分數 | Place−Hold |
|---:|---:|---:|---:|---:|---:|
| 0 | 6 | 6 | −56.50 | −57.90 | +1.40 |
| 1 | 6 | 6 | −57.80 | −57.10 | −.70 |
| 2 | 6 | 6 | −57.80 | −59.30 | +1.50 |
| 3 | 6 | 4 | −57.80 | −73.00 | +15.20 |
| 4 | 6 | 3 | −71.30 | −74.80 | +3.50 |
| 5 | 6 | 6 | −69.10 | −58.70 | −10.40 |
| 6 | 6 | 6 | −62.30 | −57.70 | −4.60 |
| 7 | 6 | 6 | −60.40 | −58.40 | −2.00 |
| 8 | 6 | 5 | −58.20 | −57.70 | −.50 |
| 9 | 6 | 6 | −59.40 | −58.70 | −.70 |

scenario3有明顯不等深且分差大，但不能直接歸因深度：局面／洞位／路徑也不同。搜尋到更深之後，分數可能上升或下降。刪掉不利scenario再平均、補一段免費搜尋、給淺層任意補分，都不成立。

## 結論與下一步界限

本輪完成之前缺失的final backprop attribution；沒有發現這646條路徑的加總或回傳bug，也沒有足夠證據選一個新evaluator weight（selectedEvaluatorModification=null）。4個固定snapshot不足以定義整體失敗類別。

如果繼續，只針對「既有預算是否過度用在其他分支，使近分root的已知延續停在中途」提出固定成本的搜尋分配假設；先查現有selection與工作分配，不增加節點、tail或wall-time，不先強迫加深所有候選。不同深度是此次觀察，不是已證實的KO失分原因，也不能據此直接採用新搜尋演算法。

保持accepted、封存舊權重掃描、停止tail。此回合只验收與記錄，未修改bot、未派新run。任何候選仍須同環境分析時間不退步，最終只由公平KO arena判斷強度。
