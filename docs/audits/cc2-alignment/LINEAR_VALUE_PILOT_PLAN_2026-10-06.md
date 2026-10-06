# 離線線性勝負預測原型

使用者授權資料盤點及一次本機小型原型；不改 bot、不開新 arena。這是明確的新方向：由既有對戰結果估計公開狀態與勝負關聯，不再修 residual 模板公式。原型不是可部署 evaluator。

## 在讀取新樣本及訓練前固定

- 資料：已驗收 run37452163955，固定 block 0–19，各2 seat-swap games，共40局、20 paired seed groups。不依勝負或局長挑選。其他本機特別下載的 terminal-Hold trace 不混入。
- 僅讀正常 KO、complete、相同 piece seed、24 cadence、零 failure／fallback／rejection／parity mismatch；完整 reports 行數核對 requests。任何缺失直接報錯，不換一個 seed 補。
- 每側每8個已放置 piece 取該格第一筆 request，最多64筆，限 playing、current 存在、Hold 尚未 locked（避免 Hold reanalysis 重複）。抽樣不根據最終剩餘壽命或輸贏。每場兩側各佔一半總權重，長局不加權。
- 只用當時 snapshot 的便宜 geometry、combo/B2B、pending、multiplier、current/Hold/NEXT5 供給摘要。排除 seed、seat、bot身分、report評分、action、未來資訊、最終局長、piece-count modulo／bag inference。這是初始人工特徵表，不聲稱涵蓋完整 Tetris 能力或等於舊 evaluator 的精確特徵。
- 小型帶 L2 的 logistic regression，固定正則係數0.01、最大500次 full-batch gradient steps；標準化只 fit training fold。使用現有 NumPy，不安裝 sklearn。步長由標準化設計矩陣的 logistic Hessian 上界決定；記錄收斂與數值梯度檢查。
- 5 folds：block modulo5。每 fold16 seed groups訓練、4 groups留出，雙方與seat-swap始終同組。無 hyperparameter sweep。這只是 grouped cross-validation，不是未來候選的獨立最終測試集。
- 固定對照：常數0.5，以及 max height／holes／pending 三特徵模型。以每局等權 log loss、Brier score 比較；另報抽樣時間≤1200 frame（20秒）的結果，檢查效果是否僅來自接近KO的盤面。小樣本與配對相關性必須明示，不用每筆snapshot當獨立樣本。
- 記錄資料處理及訓練wall time、矩陣大小、硬體。40局只能驗證流程與探索關聯，不能宣稱feature因果有效或bot變強。
- 即使有預測訊號也不直接接回CC2：勝率／logit不能直接加既有attack reward；root資料與search leaf存在distribution mismatch。value/reward契約、資訊邊界、實際成本及新seed KO仍未解決。

本輪不自動下載全部200局、不加新特徵追分、不增加arena、不部署模型。

## 固定的22項輸入（訓練前）

max height、mean height、holes、covered cells、相鄰column height差總和、height超過10／15的部分、combo、原始公開btb、btb是否超過charging門檻、pending總量、其中active量、ARE總量、公開multiplier、Hold是否可用、current是否T／I、Hold是否T／I、NEXT5中T／I數量、可見T距離。

covered cells在本原型定義為每column最深hole上方的occupied cells數；非宣稱與舊evaluator capped coveredness等同。可見T距離：current或可用Hold為T時0，否則NEXT5首次T的index+1，沒有則固定6 sentinel；不是未知等待期估計。NEXT5數量不含history，不做bag推斷。沒有額外互動項／slot偵測。固定抽樣排除locked Hold後，Hold available可能為常數，標準化須安全處理。
