# H1 common-opponent batch dispatch

- Run: https://github.com/jush0147/tetrp/actions/runs/37026070707
- Source: `8ddce9287e61d5126e076f40346e6887dfb02c08`
- Created 2026-10-02 23:18:43 Asia/Taipei (15:18:43 UTC).
- Confirmed queued after push; exactly one matching run. No ongoing polling.
- Plan: [H1_COMMON_PLAN.md](H1_COMMON_PLAN.md).
- 100 base seeds, four games each: H1 on/off each vs frozen vendored Legacy in both seats. 400 KO games total, 200 per treatment. Paired difference against common opponent, not direct on/off win rate.
- Fixed 24 frames, shared piece seed, 200k nodes. No ordinary frame cap; watchdog/timeout technical only. Simultaneous KO replaces the entire four-game block using prespecified seed schedule. Failures invalidate the strength conclusion; no silent exclusions.
- 16 concurrent runners, two isolated games per runner. No shadow search or repeated Rust builds. Thirty targeted tests passed before dispatch; existing engine and policy binaries unchanged.
- ntfy topic `just_a_kiwi_for_tetrp` notified once by terminal aggregate job. No automatic next experiment or promotion.
- When user returns, first audit completion, all 100 blocks / 400 final games, retries, identity and parity counters. Then interpret paired KO difference and interval. Never treat workflow success alone as strength evidence.
