# Independent behavioral oracle, test-only. See docs/PROVENANCE.md.
from __future__ import annotations
from math import ceil, floor

def js_round_positive_6(x: float) -> float:
    return floor(x * 1000000 + 0.5) / 1000000

def fall_probes(current_y: float, step: float) -> tuple[float, float]:
    candidate = js_round_positive_6(current_y + step)
    if candidate % 1 == 0:
        candidate += 1e-06
    probe = current_y + 1
    if probe % 1 == 0:
        probe -= 2e-06
    return (candidate, probe)

def softdrop_budget(effective_g: float, dt: float, sdf: float, version: int=19) -> float:
    if version >= 15 and sdf == 41:
        return 400 * dt
    budget = effective_g * dt * sdf
    floor_budget = 0.05 * sdf if version >= 13 else 0.42
    return max(budget, floor_budget)

def anti_stall_extra(lockresets: int, rotresets: int, dt: float, infinite_movement: bool=False) -> float:
    if infinite_movement or rotresets <= lockresets + 15:
        return 0.0
    return 0.5 * dt * (rotresets - (lockresets + 15))

def kick_y(current_y: float, kick_y: float, offset_delta_y: float, lockresets: int, total_rotations: int, infinite_movement: bool=False) -> float:
    if not infinite_movement and total_rotations > lockresets + 15:
        return current_y + kick_y + offset_delta_y
    return floor(current_y) + 0.1 + kick_y + offset_delta_y
