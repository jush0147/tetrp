# Arena placement replay import

This adds support to the normal Tetrp viewer for the original recorded arena match. It is not a TETR.IO keyboard-event export and is not compatible with older Tetrp builds. Ordinary TETR.IO replay reconstruction is unchanged.

The `authority-placement/1` stream extension stores both original seeds and ordered Hold, path/provenance, lock, and receive operations. Playback uses PlacementArenaEngine and validates the same placement certificates as the arena. Every original anchor is verified against a SHA-256 digest of the full canonical engine state, including board, Hold, queue, attack ledger, garbage RNG, statistics and timing. A mismatch rejects the stream. No policy is rerun, and snapshots do not overwrite simulated state. Bot Mode is disabled for this arena control model.

Manual navigation exposes the proven landing before its resulting clear. For presentation, the landing is shown during the latter half of its 24-frame slot; the authority still locks at the recorded frame/subframe. NEXT 5, Hold, boards and round selection use the existing Tetrp UI.

The previous `placement-recording/1` file was an unsuccessful delivery and is explicitly rejected. The separate observation Pages deployment was removed. This fix belongs in the original viewer.

Verification of source run 37616553558: nine rounds, aligned 2 : 7 built-in Kiwi; 6,328 placements and all Hold transitions replayed with zero full-state hash mismatches. The same verification passed against main's unchanged engine/attack implementation. Desktop Chromium and mobile WebKit checked all nine rounds, sampled both players' complete state at start, piece 1, piece 19, midpoint and final placement, checked landing cells and NEXT 5, and exercised playback. This is a recorded-match playback fix, not new strength evidence.

Local regression: 358 non-Python tests passed. The local Python 3.14 AST fixture differs from the Python 3.12 CI fixture; the registered local 3.12 executable is missing. CI runs the full suite with its configured Python 3.12. Do not treat the local Python result as passed.
