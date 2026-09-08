# Independent behavioral oracle, test-only. See docs/PROVENANCE.md.
M = 2147483647
A = 16807
MINOTYPES = ['z', 'l', 'o', 's', 'i', 'j', 't']

class RNG:

    def __init__(self, seed: int):
        self.seed = seed % M
        if self.seed <= 0:
            self.seed += 2147483646
            self.seed = self.seed or 1

    def next(self) -> int:
        self.seed = A * self.seed % M
        return self.seed

    def next_float(self) -> float:
        return (self.next() - 1) / 2147483646

    def shuffle(self, values):
        values = list(values)
        s = len(values)
        while True:
            s -= 1
            if not s:
                break
            t = int(self.next_float() * (s + 1))
            values[s], values[t] = (values[t], values[s])
        return values

class SevenBag:

    def __init__(self, seed: int):
        self.rng = RNG(seed)
        self.bag = []
        self.bagid = 0
        self.populate_bag()

    def populate_bag(self):
        self.bag.extend(self.rng.shuffle(MINOTYPES))
        self.bagid += 1

    def pull(self):
        while len(self.bag) < 14:
            self.populate_bag()
        return self.bag.pop(0)
