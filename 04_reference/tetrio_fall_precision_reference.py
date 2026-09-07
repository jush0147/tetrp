#!/usr/bin/env python3
"""Small clean-room oracle for selected TETR.IO v19 fall precision semantics."""
from __future__ import annotations

from math import ceil, floor


def js_round_positive_6(x: float) -> float:
    # Gameplay Y values covered here are non-negative; this matches Math.round at 1e-6 scale.
    return floor(x * 1_000_000 + 0.5) / 1_000_000


def fall_probes(current_y: float, step: float) -> tuple[float, float]:
    candidate = js_round_positive_6(current_y + step)
    if candidate % 1 == 0:
        candidate += 1e-6
    probe = current_y + 1
    if probe % 1 == 0:
        probe -= 2e-6
    return candidate, probe


def softdrop_budget(effective_g: float, dt: float, sdf: float, version: int = 19) -> float:
    if version >= 15 and sdf == 41:
        return 400 * dt
    budget = effective_g * dt * sdf
    floor_budget = 0.05 * sdf if version >= 13 else 0.42
    return max(budget, floor_budget)


def anti_stall_extra(lockresets: int, rotresets: int, dt: float, infinite_movement: bool = False) -> float:
    if infinite_movement or rotresets <= lockresets + 15:
        return 0.0
    return 0.5 * dt * (rotresets - (lockresets + 15))


def kick_y(current_y: float, kick_y: float, offset_delta_y: float, lockresets: int,
           total_rotations: int, infinite_movement: bool = False) -> float:
    if not infinite_movement and total_rotations > lockresets + 15:
        return current_y + kick_y + offset_delta_y
    return floor(current_y) + 0.1 + kick_y + offset_delta_y


def _self_test() -> None:
    a, b = fall_probes(17.0, 1.0)
    assert a == 18.000001 and b == 17.999998
    assert ceil(a) == 19 and ceil(b) == 18

    assert abs(softdrop_budget(0.02, 1.0, 6) - 0.3) < 1e-12
    assert abs(softdrop_budget(0.02, 0.4, 6) - 0.3) < 1e-12
    assert abs(softdrop_budget(0.2, 0.4, 6) - 0.48) < 1e-12
    assert softdrop_budget(0.02, 0.4, 41) == 160.0

    assert anti_stall_extra(15, 30, 1.0) == 0
    assert anti_stall_extra(15, 31, 1.0) == 0.5
    assert abs(anti_stall_extra(15, 35, 0.4) - 1.0) < 1e-12

    assert abs(kick_y(17.96, 1, 0, 15, 30) - 18.1) < 1e-12
    assert abs(kick_y(17.96, 1, 0, 15, 31) - 18.96) < 1e-12
    print("self-test: PASS")


if __name__ == "__main__":
    _self_test()
