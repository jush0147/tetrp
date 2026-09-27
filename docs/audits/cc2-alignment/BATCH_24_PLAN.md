# Fixed overnight replication: 24 KO games, 12 paired seeds

Authorized 2026-09-28 after the valid 6–7 FT7. No bot, evaluator, budget or WASM changes. This is a fixed-size application regression/strength test, not a recurring workload or open-ended search. Repo is public; use standard ubuntu-latest runners and maximum two concurrent jobs. GitHub permits Actions for application development/testing and provides free standard runner usage for public repositories (official documentation checked at dispatch).

Twelve fresh seed pairs, two swapped-seat legs each. Piece seed `2026100001 + pair*100`, the same on both seats; private hole seeds are piece seed +1/+2 assigned to seats, unchanged between paired legs. Both policies use current+NEXT5 snapshot-only and 200k nodes; both advance 24 virtual frames per placement. Exact candidate artifact from run 36323060219 versus Tetrp vendored Kiwi snapshot-v3.2.

One independent job per leg. First non-simultaneous authority KO completes that leg. Simultaneous KO is unscored and retries with seed +4; at most 25 attempts fit each pair's nonoverlapping seed range. Exhaustion is incomplete, never a win. Technical/certificate/unsupported-rule/parity errors stop that leg; other fixed jobs may finish, but any failure marks the overall batch incomplete. No ordinary gameplay frame cap. Existing 360k-frame watchdog and 120-minute infrastructure timeout are technical failures. Job limit 130 minutes reserves upload time. No automatic reruns or follow-on batches.

Full raw audit JSONL retained as compressed artifacts for seven days, summary for thirty. After all jobs terminate, aggregate checked KO counts and send one ntfy notification. Missing/failed legs must be explicit; do not interpret an incomplete batch as the planned 24-game result. Download and independently audit raw records before strength conclusions. The twelve pairs are the natural units for assessing seat/stream sensitivity; their 24 legs should not be described as 24 independent seed samples.

References: https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features and https://docs.github.com/en/actions/concepts/billing-and-usage .
