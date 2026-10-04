# 第5項：Tetris井深審查與離線候選

2026-10-04，使用者授權等待B2B兩批期間先準備，不新增Actions對戰。此文件不是promotion或dispatch授權；B2B clear=0／2兩批照原計畫，沒有查詢或更動它們。

## 原實作實際量什麼

來源：frozen CC2 commit `2e243242b674d57491f99b445f75e35fc48a0e26`＋accepted patch run36387270053，`src/bot/freestyle.rs::evaluate`。盤面是10個u64欄，低bit為底部。

1. 先执行既有T-slot模板估值。若預測填T後可消超過1行，會在evaluator的局部board副本填入並移除這些行。這不是實際搜尋狀態的authority lock。
2. 在這個可能已被cutout改過的board上，選表面高度最低的欄。
3. 將另外9欄bitwise AND，得到「除選中欄外都已填滿」的橫列。
4. 從最低欄頂端往上，數這些橫列連續有幾列；第一個不滿的橫列就停止。
5. leaf加`0.3 × 列數`。非edge Reward，沒有4行一組取整、攻擊倍率、分數上限或折現。

例：其餘9欄底部4行皆滿、井欄空，depth=4，+1.2分；8行為+2.4分；1或3行也加+0.3／+0.9，不要求已能Tetris。若第3行另外一欄也缺格，僅計前2行。若兩欄都空，通常沒有「其餘9欄皆滿」的列，這項為0。被roof遮住的洞不等同開口井，井欄高度會從roof上方起算。

## 兌現與資訊邊界

這筆分數本身不直接檢查I是否在current／NEXT5／Hold、何時輪到I、Hold可用性、vertical-I movegen、rotation/kick路徑、spawn/clutch/topout或incoming入場前是否來得及。它也不直接讀hidden future，未新增piece/bag inference。

不能因此說整個bot不會考慮I：有限可見搜尋仍可能真的找到I消行並評價其交易，這只是leaf proxy本身無兌現條件。井看似開口也不構成從active pose合法可達、符合時限或安全存活的證明。這次不藉審查擴充I-gating、reachability或新殘值模型。

T的影響則是間接的：cutout次數由state.bag是否有T、reserve是否T及bag.len()<=3啟發式決定。這是既有cutout邏輯，不是實際未知tail的T保證；它可能改變井深，再改其他board leaf項。移除well bonus不會移除cutout。

## 與其他項的重疊

| 項目 | 關係及不能推論的事 |
|---|---|
| height family | 在同一cutout後board上懲罰最大高度；深井資產分可局部抵銷高度成本。相關但非相同量，不能僅看係數宣稱相消或冗餘。 |
| holes／coveredness | 同樣在cutout後board計算；開口井的空格不會因井壁高就成為該欄被覆蓋洞，因而well不是這兩項的等價反號。 |
| row transitions | 井邊形成橫向邊界，可能同時有transition成本與well分；需要比較整盤，不能把0.3單獨當完整井評價。 |
| T-slot | 可先改局部board，連帶改well／height／holes／coverage／transitions；bonus=0不等於移除T-slot機制。 |
| H1／H9 | 在cutout前真實board計壓力／封閉空間，與well對象不同。關well不改共享係數或H1/H9。 |
| 實際sent／B2B／combo | 搜到兌現時，authority-aligned transition仍評價攻擊和後續狀態；well是還未兌現的幾何proxy，非攻擊行數本身。 |

它有合理資產直覺，但其增量效益仍未知；不能因沒I條件判它一定有害，也不能因CC2用了它就判重要。

## 已準備的最小候選與測試

只將review profile `tetris_well_depth=0.3→0`，全部其他參數保持原accepted（包含三表原值、B2B clear=1、Boolean=.5、bank=0）。不疊加目前實驗。獨立離線prepare `scripts/kiwi-well-depth-prepare.js`，明確要求isolated source目錄；cfg `well_depth_off`只控制此係數，evaluator函式本體byte-identical，仅附加測試模組。

Rust `well_depth_gate_tests`已備好：手算平井depth0/1/3/4/8、左/中/右井、有/無I、Hold I/O、被打斷連續列、墊底、雙空欄、roof，以及T-slot cutout前後的具體見證。每個state比較on/off完整evaluator，edge Reward不變，leaf delta只能是−0.3×深度；terminal delta=0。

Cutout見證（cols底部bit編碼）：`[1,0,5,3,3,3,3,3,3,3]`，不允許cutout時well depth=1。模板填South T於(1,1)會移除底2行，成`[0,0,1,0,0,0,0,0,0,0]`，well depth=0。測試檢查實際模板輸出、消行數與post-board，不把這個模板假想填法當合法路徑證書。

本機JS配置隔離／scope防誤改及provenance 5項通過；實際accepted source安裝也核對evaluator本體未變。Rust本機不可執行，這些Rust測試尚未編譯通過，不冒稱correctness已完成。

## 尚未做

沒有push、workflow修改、Actions gate、arena或ntfy新任務，production保持不變。後續真正啟動前，需讓Rust tests／完整配置identity／frozen report parity／固定public snapshot top1與Hold parity通過，且驗證真實top1 activation。預設仍先等第4項結果處理，再決定第5項dispatch；此處只降低下一步準備等待時間。
