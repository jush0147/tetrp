# B2B Boolean leaf off：固定200新KO

使用者在gate結果後指示繼續。這批僅比較`has_back_to_back 0.5→0`，不調其他權重，不啟用H3，不把Boolean結果當完整Surge inventory結論。

- 沿用已通過run37105409459的artifact，不重編、不重跑67份search gate。啟動前核完整配置、manifest、binary hash及frozen控制環境。
- Candidate SHA256 `9011774f35782537fc15909883169638584516238df28590a3f2ee469540fa52`；accepted `386e53fcb607015d30dab78401e37f4f2ec1c315044a27b736561a0428788feb`。
- 對手為Tetrp vendored Legacy snapshot-v3.2，不是stock CC2。候選與accepted都獨立對相同Legacy，並非互打。
- 100 blocks，seed=2026160001+100×block；每block候選交換seat，共200新KO。每局雙方同piece seed；hole seed=seed+1/+2。重用run37026070707全部同seed/seat accepted 200控制局（104–96）；原artifact SHA及完整400局audit都必須通過。
- 主判讀為候選對Legacy勝率減accepted對Legacy勝率；100 seed clusters、每版兩seat，配對近似95% CI。控制結果已知，屬後續比較，不是獨立確認。沒有optional stopping、追加到顯著或自動promotion。
- 每方200k nodes/request、24 virtual frames/placement、PublicSnapshot/NEXT5、Tetrp authority `tl-placement-v1`。Parallel search join barrier保持virtual transaction order。
- 只KO給分；無普通gameplay frame cap。360000-frame watchdog、timeout、任何technical/parity/certificate/rejection/fallback都使批次無強度結論。完整失敗dump保留。
- simultaneous KO整block作廢，seed+4×attempt，最多25 attempts；重跑該block兩版×兩seat全部4局，不只挑候選重打。例外增加的控制局與總成本另列。
- 維持已驗證16 runners同時、每runner兩局；100 block jobs，每job90分鐘、game step80分鐘；10分鐘artifact檢查、15分鐘aggregate。標準repo CI另跑。不是100個runner同時占用。
- 完整壓縮trace保留3天；summary/artifact30天。每25 placements進度，不持續監看。完成／失敗ntfy `just_a_kiwi_for_tetrp`。
- 無第二候選queue，無production改動。本機驗證新summary/audit測試、67snapshot restore及artifact/control identity；正式run另記dispatch。

上一批相同執行形式的wasted-off用了1h46m；本批局長可能不同，因此不承諾同耗時。用已完成gate，避免再花時間重建或重複pilot。
