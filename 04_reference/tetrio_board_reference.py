"""Small clean-room reference for selected TETR.IO v19 board predicates.

This intentionally models only low-level board semantics that have been
confirmed from the production client. It is not a complete game engine.
"""

from math import ceil

EMPTY = None
GB = "gb"
GBD = "gbd"


class BoardReference:
    def __init__(self, width=10, visible_height=20, buffer=20):
        self.W = width
        self.H = visible_height
        self.B = buffer
        self.T = visible_height + buffer
        self.board = [[EMPTY for _ in range(width)] for _ in range(self.T)]

    def occupied(self, x, y):
        if x < 0 or x >= self.W or y < 0 or y >= self.T:
            return True
        row = ceil(y)
        if row < 0 or row >= self.T:
            return True
        return self.board[row][x] is not EMPTY

    @staticmethod
    def row_is_clearable_full(row):
        return all(cell is not EMPTY and cell != GBD for cell in row)

    def full_lines(self):
        return [i for i, row in enumerate(self.board) if self.row_is_clearable_full(row)]

    def is_full_top_row(self):
        return all(cell is not EMPTY for cell in self.board[0])

    def is_empty(self):
        return all(all(cell is EMPTY for cell in row) for row in self.board)

    def is_empty_with_perma(self):
        return all(all(cell in (EMPTY, GBD) for cell in row) for row in self.board)

    def is_empty_with_unclearable(self):
        for row in self.board:
            empty_or_perma = all(cell in (EMPTY, GBD) for cell in row)
            garbage_or_perma = all(cell in (GB, GBD) for cell in row)
            if not (empty_or_perma or garbage_or_perma):
                return False
        return True

    def remove_lines(self, lines):
        for row in sorted(lines, reverse=True):
            self.board.pop(row)
        while len(self.board) < self.T:
            self.board.insert(0, [EMPTY] * self.W)


def _self_test():
    b = BoardReference()
    assert b.occupied(-1, 20)
    assert b.occupied(10, 20)
    assert b.occupied(4, -0.001)
    assert b.occupied(4, 40)

    b.board[18][4] = "t"
    assert not b.occupied(4, 17.0)
    assert b.occupied(4, 17.01)
    assert b.occupied(4, 17.96)

    assert BoardReference.row_is_clearable_full([GB] * 10)
    assert not BoardReference.row_is_clearable_full(["t"] * 9 + [GBD])

    b = BoardReference()
    b.board[39][2] = GBD
    assert not b.is_empty()
    assert b.is_empty_with_perma()
    assert b.is_empty_with_unclearable()

    b = BoardReference()
    b.board[39] = [GB] * 10
    assert not b.is_empty_with_perma()
    assert b.is_empty_with_unclearable()

    b = BoardReference()
    b.board[39] = ["t"] * 10
    old_len = len(b.board)
    b.remove_lines([39])
    assert len(b.board) == old_len == 40
    assert b.board[0] == [EMPTY] * 10

    print("self-test OK")


if __name__ == "__main__":
    _self_test()
