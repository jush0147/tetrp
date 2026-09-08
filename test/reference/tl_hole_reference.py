# Independent behavioral oracle, test-only. See docs/PROVENANCE.md.
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
        self.seed = MUL * self.seed % MOD
        return self.seed

    def next_float(self) -> float:
        return (self.next() - 1) / DEN

class TLGarbageHoles:

    def __init__(self, seed: int, width: int=10):
        self.rng = ParkMiller(seed)
        self.width = width
        self.lastcolumn = None
        self.haschangedcolumn = False

    def reroll(self) -> int:
        self.lastcolumn = int(self.rng.next_float() * self.width)
        return self.lastcolumn

    def tank_packet(self, amount: int):
        out = []
        for _ in range(amount):
            col = self.lastcolumn
            if col is None:
                if not self.haschangedcolumn:
                    col = self.reroll()
                    self.haschangedcolumn = True
            else:
                inner_draw = self.rng.next_float()
                if inner_draw < 0.0:
                    if not self.haschangedcolumn:
                        col = self.reroll()
                        self.haschangedcolumn = True
            out.append(col)
            self.haschangedcolumn = False
        if amount > 0:
            if self.rng.next_float() < 1.0:
                self.reroll()
                self.haschangedcolumn = True
        return out

    def cancel_whole_packet(self):
        if self.rng.next_float() < 1.0:
            self.reroll()
            self.haschangedcolumn = True
