# Phase 2: Replay parser / reconstruction

Do not start this phase until the deterministic engine milestone is stable.

Target interface should eventually support:

- parse `.ttr` / `.ttrm`
- enumerate rounds and players
- seek by frame and by piece placement
- reconstruct canonical engine state at an arbitrary review point
- fork an analysis branch from that state

The replay parser should remain separate from rendering and bot adapters.
