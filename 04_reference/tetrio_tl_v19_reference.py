#!/usr/bin/env python3
"""High-level reference model for TETR.IO Tetra League v19 attack/garbage flow.

Reverse-engineered from the production client bundle in the user's
01_Official_Standalone package. This is NOT TETR.IO source code and does not
model board geometry, rotation, piece movement, or the private match
coordinator. It exists to preserve ordering/edge-case semantics for a clean-room
engine implementation.

Covered:
- TL v19 base attack table
- combo multiplier
- B2B +1 bonus with B2B Charge/Surge release
- All Clear B2B contribution and separate 5-attack packet
- opener-phase defense budget
- garbage special bonus for garbage-clearing Quad/recognized Spin (mini or full)
- combo blocking
- per-tank garbage cap 8
- cancellable inactive/in-flight garbage
- two-stage interaction -> interaction_confirm travel activation
- acknowledgement-aware zero-passthrough cross-cancel ledger
- TL garbage multiplier growth after 180 s

Not covered:
- board/holes/messiness RNG and actual PushLine geometry
- SRS+/spin classification itself (spin result is supplied to lock())
- private server target selection / KO coordinator
- replay binary encoding
- Zenith/custom-mode modifiers
"""
from __future__ import annotations

from dataclasses import dataclass, field
from math import floor, log1p
from typing import Dict, List, Literal, Optional, Tuple

Spin = Literal["none", "mini", "full"]

BASE_ATTACK = {
    (0, "none"): 0,
    (0, "mini"): 0,
    (0, "full"): 0,
    (1, "none"): 0,
    (1, "mini"): 0,
    (1, "full"): 2,
    (2, "none"): 1,
    (2, "mini"): 1,
    (2, "full"): 4,
    (3, "none"): 2,
    (3, "mini"): 2,
    (3, "full"): 6,
    (4, "none"): 4,
    (4, "mini"): 4,
    (4, "full"): 10,
    (5, "none"): 5,
    (5, "full"): 12,
}


def js_round_nonnegative(x: float) -> int:
    """JavaScript Math.round for the non-negative values used here."""
    return floor(x + 0.5)


def base_attack(lines: int, spin: Spin) -> int:
    if (lines, spin) in BASE_ATTACK:
        return BASE_ATTACK[(lines, spin)]
    if lines > 5:
        return 12 + 2 * (lines - 5) if spin == "full" else 5 + (lines - 5)
    # Mini penta is not a normal TL tetromino case; keep generic fallback conservative.
    if lines == 5 and spin == "mini":
        return 5
    raise ValueError((lines, spin))


@dataclass
class Packet:
    cid: int
    sender: str
    iid: int
    ackiid: int
    amt: int
    active: bool = False
    hardened: bool = False
    confirm_frame: Optional[int] = None
    active_frame: Optional[int] = None


@dataclass
class LedgerEntry:
    iid: int
    amt: int


@dataclass
class Totals:
    attack_generated: int = 0
    cancelled: int = 0
    sent: int = 0
    received_interactions: int = 0
    tanked: int = 0


@dataclass
class TLState:
    frame: int = 0
    piecesplaced: int = 0
    combo: int = 0              # internal value: first line clear => 1
    btb: int = 0                # raw engine chain state
    garbage_multiplier: float = 1.0
    pending: List[Packet] = field(default_factory=list)
    garbage_are_entries: List[Packet] = field(default_factory=list)
    cumulative_sent: int = 0
    interaction_id: int = 0
    next_cid: int = 0
    incoming_ack: Dict[str, int] = field(default_factory=dict)
    outgoing_ack: Dict[str, List[LedgerEntry]] = field(default_factory=dict)
    totals: Totals = field(default_factory=Totals)


class TetraLeagueV19:
    FPS = 60
    GARBAGE_SPEED = 20
    GARBAGE_CAP = 8
    OPENER_PHASE = 14
    B2B_CHARGE_AT = 4
    B2B_CHARGE_BASE = 0
    ALL_CLEAR_GARBAGE = 5
    GARBAGE_MARGIN = 10800
    GARBAGE_INCREASE_PER_SECOND = 0.008

    def __init__(self, player_id: str = "P1", target_id: str = "P2"):
        self.player_id = player_id
        self.target_id = target_id
        self.s = TLState()
        self.outbox: List[dict] = []

    # ---------- frame/time ----------
    def advance_to(self, frame: int) -> None:
        """Advance to the *start* of `frame` and activate confirmed packets.

        In the client loop, gameplay for frame F occurs before that frame's
        garbage-multiplier growth increment. Therefore at the start of F the
        number of applied increments is max(0, F - (margin + 1)).
        """
        if frame < self.s.frame:
            raise ValueError("cannot rewind")
        rate_per_frame = self.GARBAGE_INCREASE_PER_SECOND / self.FPS
        old_count = max(0, self.s.frame - (self.GARBAGE_MARGIN + 1))
        new_count = max(0, frame - (self.GARBAGE_MARGIN + 1))
        self.s.garbage_multiplier += (new_count - old_count) * rate_per_frame
        self.s.frame = frame
        for p in self.s.pending:
            if p.active_frame is not None and frame >= p.active_frame:
                p.active = True

    # ---------- acknowledgement-aware interaction flow ----------
    def _record_outgoing(self, opponent: str, amount: int) -> int:
        self.s.interaction_id += 1
        iid = self.s.interaction_id
        self.s.outgoing_ack.setdefault(opponent, []).append(LedgerEntry(iid, amount))
        return iid

    def _send(self, amount: int, target: Optional[str] = None) -> Optional[dict]:
        if amount <= 0:
            return None
        target = target or self.target_id
        self.s.totals.sent += amount
        self.s.cumulative_sent += amount
        iid = self._record_outgoing(target, amount)
        event = {
            "type": "garbage",
            "from": self.player_id,
            "to": target,
            "iid": iid,
            "ackiid": self.s.incoming_ack.get(target, 0),
            "amt": amount,
        }
        self.outbox.append(event)
        return event

    def receive_interaction(self, event: dict) -> Optional[int]:
        """Handle server IGE `interaction` (before interaction_confirm).

        Zero-passthrough cross-cancel occurs here. The remainder is inserted as
        an inactive but already-cancellable pending packet. Returns local cid.
        """
        sender = event["from"]
        iid = int(event["iid"])
        ackiid = int(event.get("ackiid", 0))
        amount = int(event["amt"])
        self.s.incoming_ack[sender] = max(iid, self.s.incoming_ack.get(sender, 0))

        kept: List[LedgerEntry] = []
        for rec in self.s.outgoing_ack.get(sender, []):
            if rec.iid <= ackiid:
                # The peer has acknowledged this outgoing interaction.
                continue
            use = min(rec.amt, amount)
            rec.amt -= use
            amount -= use
            if rec.amt > 0:
                kept.append(rec)
        self.s.outgoing_ack[sender] = kept

        if amount <= 0:
            return None
        self.s.next_cid += 1
        cid = self.s.next_cid
        self.s.pending.append(Packet(
            cid=cid, sender=sender, iid=iid, ackiid=ackiid, amt=amount, active=False
        ))
        return cid

    def confirm_interaction(self, cid: int) -> None:
        """Handle server IGE `interaction_confirm` for garbage.

        Confirmation starts the ordinary 20F incoming travel countdown. Pending
        garbage remains cancellable during this inactive period.
        """
        p = next((p for p in self.s.pending if p.cid == cid), None)
        if not p:
            return
        p.confirm_frame = self.s.frame
        p.active_frame = self.s.frame + self.GARBAGE_SPEED
        self.s.totals.received_interactions += 1

    def inject_test_pending(self, amount: int, *, active: bool = True,
                            hardened: bool = False, sender: str = "TEST") -> int:
        """Convenience for deterministic tests without coordinator traffic."""
        self.s.next_cid += 1
        cid = self.s.next_cid
        self.s.pending.append(Packet(
            cid=cid, sender=sender, iid=0, ackiid=0, amt=amount,
            active=active, hardened=hardened,
            active_frame=self.s.frame if active else None,
        ))
        return cid

    # ---------- cancellation / offence ----------
    def pending_count(self) -> int:
        return sum(p.amt for p in self.s.pending)

    def _consume_list(self, packets: List[Packet], attack: int, defense: int) -> Tuple[int, int, int]:
        cancelled = 0
        idx = 0
        while attack > 0 or defense > 0:
            if idx >= len(packets):
                break
            p = packets[idx]
            if p.hardened:
                idx += 1
                continue
            p.amt -= 1
            if attack:
                attack -= 1
            else:
                defense -= 1
            cancelled += 1
            if p.amt <= 0:
                packets.pop(idx)
            # If not exhausted, stay on same packet.
        return attack, defense, cancelled

    def fight_lines(self, attack: int, *, target: Optional[str] = None) -> dict:
        """TL FightLines ordering including opener defense budget."""
        original = int(attack)
        self.s.totals.attack_generated += original

        defense = 0
        if (self.s.piecesplaced <= self.OPENER_PHASE
                and self.pending_count() >= self.s.cumulative_sent):
            defense += original

        attack, defense, c1 = self._consume_list(self.s.garbage_are_entries, attack, defense)
        attack, defense, c2 = self._consume_list(self.s.pending, attack, defense)
        cancelled = c1 + c2
        self.s.totals.cancelled += cancelled
        sent_event = self._send(attack, target)
        return {
            "generated": original,
            "cancelled": cancelled,
            "sent": 0 if sent_event is None else sent_event["amt"],
            "unused_defense_budget": defense,
        }

    # ---------- line-clear pipeline ----------
    def _surge_packets_if_breaking(self, lines: int, b2b_contribution: int) -> List[int]:
        if not lines or b2b_contribution > 0:
            return []
        if self.s.btb <= self.B2B_CHARGE_AT:
            self.s.btb = 0
            return []
        surge = floor((self.s.btb - self.B2B_CHARGE_AT + self.B2B_CHARGE_BASE)
                      * self.s.garbage_multiplier)
        a = js_round_nonnegative(surge / 3)
        packets = [a, a, surge - 2 * a]
        self.s.btb = 0
        return [x for x in packets if x]

    def _normal_clear_attack(self, lines: int, spin: Spin, *, all_clear: bool,
                             garbage_rows_cleared: int, b2b_contribution: int) -> int:
        raw = float(base_attack(lines, spin))

        # Current TL has b2bchaining=0, so a qualifying B2B gets fixed +1.
        allow_b2b_send_bonus = not (all_clear and b2b_contribution == 1)
        if (lines or b2b_contribution) and self.s.btb > 1 and allow_b2b_send_bonus:
            raw += 1.0

        # Multiplier combo table.
        if self.s.combo > 1:
            raw *= 1 + 0.25 * (self.s.combo - 1)
            if self.s.combo > 2:
                raw = max(log1p(1.25 * (self.s.combo - 1)), raw)

        attack = floor(raw * self.s.garbage_multiplier)  # TL roundmode=down

        # Applied after multiplier/rounding; any recognized Spin (mini/full) or Quad + garbage row.
        if garbage_rows_cleared > 0 and (lines == 4 or spin != "none"):
            attack += 1
        return attack

    def tank(self) -> int:
        """Inject up to 8 active, non-shielded spawn-equivalent lines.

        TL garbagephase=0 / garbageentry=instant, so active normal packets are
        sufficient here. Hardened affects cancellation, not tank eligibility.
        """
        amount = 0
        idx = 0
        while amount < self.GARBAGE_CAP and idx < len(self.s.pending):
            p = self.s.pending[idx]
            if not p.active:
                idx += 1
                continue
            take = min(p.amt, self.GARBAGE_CAP - amount)
            p.amt -= take
            amount += take
            if p.amt <= 0:
                self.s.pending.pop(idx)
            else:
                idx += 1
        self.s.totals.tanked += amount
        return amount

    def lock(self, lines: int = 0, spin: Spin = "none", *, all_clear: bool = False,
             garbage_rows_cleared: int = 0) -> dict:
        """Process one piece lock in TL ordering.

        Spin classification is input to this high-level model; a full clean-room
        engine would obtain it from FallingPiece/RulesManager before this call.
        """
        self.s.piecesplaced += 1

        if lines > 0:
            self.s.combo += 1
        else:
            self.s.combo = 0

        b2b_contribution = 1 if all_clear else 0
        if lines >= 4 or (lines > 0 and spin != "none"):
            b2b_contribution += 1

        surge_results: List[dict] = []
        if b2b_contribution > 0:
            self.s.btb += b2b_contribution
        elif lines > 0:
            for packet in self._surge_packets_if_breaking(lines, b2b_contribution):
                surge_results.append(self.fight_lines(packet))
        # No-clear placement does not break B2B.

        normal_attack = self._normal_clear_attack(
            lines, spin, all_clear=all_clear,
            garbage_rows_cleared=garbage_rows_cleared,
            b2b_contribution=b2b_contribution,
        )

        normal_result = self.fight_lines(normal_attack) if lines or normal_attack else {
            "generated": 0, "cancelled": 0, "sent": 0, "unused_defense_budget": 0
        }

        # AnnounceClear() is a separate post-normal-clear attack path.
        all_clear_result = None
        if all_clear:
            ac = floor(self.ALL_CLEAR_GARBAGE * self.s.garbage_multiplier)
            all_clear_result = self.fight_lines(ac)

        # combo blocking: any line clear (even zero attack) blocks this placement.
        blocked_tank = bool(lines or normal_attack)
        tanked = 0 if blocked_tank else self.tank()

        return {
            "frame": self.s.frame,
            "piece": self.s.piecesplaced,
            "lines": lines,
            "spin": spin,
            "combo_internal": self.s.combo,
            "combo_display": max(0, self.s.combo - 1),
            "btb_raw": self.s.btb,
            "garbage_multiplier": self.s.garbage_multiplier,
            "surge": surge_results,
            "normal": normal_result,
            "all_clear": all_clear_result,
            "blocked_tank": blocked_tank,
            "tanked": tanked,
            "pending_after": self.pending_count(),
        }


def _self_test() -> None:
    # 1) zero-attack Single still blocks tanking.
    g = TetraLeagueV19()
    g.inject_test_pending(8, active=True)
    r = g.lock(lines=1)
    assert r["normal"]["generated"] == 0 and r["tanked"] == 0 and g.pending_count() == 8
    r = g.lock(lines=0)
    assert r["tanked"] == 8 and g.pending_count() == 0

    # 2) opener defense: A=4 can cancel up to 8 when qualification is true.
    g = TetraLeagueV19()
    g.inject_test_pending(6, active=False)
    r = g.lock(lines=4)
    assert r["normal"]["generated"] == 4
    assert r["normal"]["cancelled"] == 6
    assert r["normal"]["sent"] == 0

    # 3) garbage special bonus: a garbage-clearing Quad gains +1.
    g = TetraLeagueV19()
    r = g.lock(lines=4, garbage_rows_cleared=1)
    assert r["normal"]["generated"] == 5

    # 3b) recognized mini spins also set the general spin bit semantics.
    g = TetraLeagueV19()
    r = g.lock(lines=1, spin="mini", garbage_rows_cleared=1)
    assert r["normal"]["generated"] == 1  # base mini single 0 + special bonus 1
    assert r["btb_raw"] == 1

    # 4) B2B charge release is processed before breaking clear's own attack.
    g = TetraLeagueV19()
    # Five quads produce raw btb=5. First no bonus; later +1, but chain survives.
    for _ in range(5):
        g.lock(lines=4)
    g.inject_test_pending(10, active=True)
    r = g.lock(lines=2)  # break B2B with Double
    # surge = floor((5-4)*1) = 1, JS Math.round(1/3)=0 => [0,0,1].
    assert sum(x["generated"] for x in r["surge"]) == 1
    assert r["surge"][0]["cancelled"] == 1

    # 5) interaction -> confirm: pending is cancellable before it becomes active/tankable.
    a = TetraLeagueV19("A", "B")
    cid = a.receive_interaction({"from": "B", "to": "A", "iid": 1, "ackiid": 0, "amt": 4})
    assert cid is not None and a.pending_count() == 4
    a.confirm_interaction(cid)
    # Clear before +20F can cancel it despite inactive state.
    r = a.lock(lines=4)
    assert r["normal"]["cancelled"] >= 4 and a.pending_count() == 0

    # 6) zero-passthrough acknowledgement-aware cross-cancel.
    a = TetraLeagueV19("A", "B")
    a._send(4, "B")  # iid 1 outstanding
    cid = a.receive_interaction({"from": "B", "to": "A", "iid": 9, "ackiid": 0, "amt": 3})
    assert cid is None  # 3 crossed against our unacknowledged 4
    assert a.s.outgoing_ack["B"][0].amt == 1

    # 7) once peer ackiid covers our outgoing iid, it no longer cross-cancels.
    cid = a.receive_interaction({"from": "B", "to": "A", "iid": 10, "ackiid": 1, "amt": 3})
    assert cid is not None and a.pending_count() == 3

    print("self-test: PASS")


if __name__ == "__main__":
    _self_test()

    demo = TetraLeagueV19()
    demo.inject_test_pending(12, active=True)
    for event in [
        dict(lines=4),
        dict(lines=2, spin="full"),
        dict(lines=4, garbage_rows_cleared=1),
        dict(lines=1),
        dict(lines=0),
    ]:
        print(demo.lock(**event))
