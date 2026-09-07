"""Minimal TETR.IO v19 ordinary 7-bag reference.

Models the Park-Miller PRNG, built-in minotype source order, Fisher-Yates
shuffle, setup's initial PopulateBag(), and PullFromBag()'s >=14 prefill rule.
"""

M = 2147483647
A = 16807
MINOTYPES = ["z", "l", "o", "s", "i", "j", "t"]


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
            values[s], values[t] = values[t], values[s]
        return values


class SevenBag:
    def __init__(self, seed: int):
        self.rng = RNG(seed)
        self.bag = []
        self.bagid = 0
        # TETR.IO SetOptions() does this before the first Next().
        self.populate_bag()

    def populate_bag(self):
        self.bag.extend(self.rng.shuffle(MINOTYPES))
        self.bagid += 1

    def pull(self):
        while len(self.bag) < 14:
            self.populate_bag()
        return self.bag.pop(0)


def raw_bags(seed: int, count=3):
    rng = RNG(seed)
    return [rng.shuffle(MINOTYPES) for _ in range(count)]


def self_test():
    expected = {
        1: ["ojilstz", "toljsiz", "lisotzj"],
        42: ["otiljsz", "ijzlost", "ijszlot"],
        12345: ["lostijz", "loztisj", "ostzjil"],
        2147483646: ["zsioljt", "osizjlt", "osztijl"],
    }
    for seed, wanted in expected.items():
        got = ["".join(b) for b in raw_bags(seed, 3)]
        assert got == wanted, (seed, got, wanted)

    # Verify the prefill behavior around the first two PullFromBag calls.
    q = SevenBag(1)
    assert len(q.bag) == 7
    first = q.pull()
    assert first == "o"
    assert len(q.bag) == 13
    assert q.bagid == 2
    second = q.pull()
    assert second == "j"
    assert len(q.bag) == 19
    assert q.bagid == 3
    print("self-test OK")
    print("first two pieces:", first, second)
    print("queued after second pull:", "".join(q.bag))
    print("rng seed:", q.rng.seed)


if __name__ == "__main__":
    self_test()
