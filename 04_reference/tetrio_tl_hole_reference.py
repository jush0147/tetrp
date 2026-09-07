"""Small clean-room reference for TETR.IO v19 TL garbage-hole RNG call ordering.

This is not a whole TETR.IO engine. It intentionally focuses on the ordinary
TL defaults: 10-wide board, hole size 1, garbagefavor 0, messiness_change 1,
messiness_inner 0, no explicit packet column.
"""

MOD = 2147483647
MUL = 16807
DEN = 2147483646


class ParkMiller:
    def __init__(self, seed: int):
        self.seed = seed % MOD
        if self.seed <= 0:
            self.seed += MOD - 1
            self.seed = self.seed or 1

    def next(self) -> int:
        self.seed = (MUL * self.seed) % MOD
        return self.seed

    def next_float(self) -> float:
        return (self.next() - 1) / DEN


class TLGarbageHoles:
    def __init__(self, seed: int, width: int = 10):
        self.rng = ParkMiller(seed)
        self.width = width
        self.lastcolumn = None
        self.haschangedcolumn = False

    def reroll(self) -> int:
        self.lastcolumn = int(self.rng.next_float() * self.width)
        return self.lastcolumn

    def tank_packet(self, amount: int):
        """Return hole column for each tanked row of one ordinary packet."""
        out = []
        for _ in range(amount):
            col = self.lastcolumn
            if col is None:
                if not self.haschangedcolumn:
                    col = self.reroll()
                    self.haschangedcolumn = True
            else:
                # Source evaluates random < messiness_inner even when inner=0.
                inner_draw = self.rng.next_float()
                if inner_draw < 0.0:  # deliberately impossible, preserves call order
                    if not self.haschangedcolumn:
                        col = self.reroll()
                        self.haschangedcolumn = True
            out.append(col)
            self.haschangedcolumn = False

        # Packet exhaustion: random < 1, then reroll.
        if amount > 0:
            if self.rng.next_float() < 1.0:
                self.reroll()
                self.haschangedcolumn = True
        return out

    def cancel_whole_packet(self):
        """Model the packet-depletion messiness hook after full cancellation."""
        if self.rng.next_float() < 1.0:
            self.reroll()
            self.haschangedcolumn = True


def _self_test():
    a = TLGarbageHoles(12345)
    holes_a = a.tank_packet(4)
    assert len(set(holes_a)) == 1
    state_after_tank = a.rng.seed

    b = TLGarbageHoles(12345)
    b.cancel_whole_packet()
    state_after_cancel = b.rng.seed

    # Tanking four rows and cancelling the packet are intentionally not RNG-equivalent.
    assert state_after_tank != state_after_cancel

    c = TLGarbageHoles(12345)
    p1 = c.tank_packet(4)
    p2 = c.tank_packet(4)
    assert len(set(p1)) == 1 and len(set(p2)) == 1
    print("self-test OK")
    print("packet1", p1)
    print("packet2", p2)
    print("rng_seed", c.rng.seed)


if __name__ == "__main__":
    _self_test()
