"""Test-only JSON bridge to the supplied independent reference programs."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '04_reference'))
from tetrio_bag_reference import SevenBag
from tetrio_board_reference import BoardReference
from tetrio_tl_hole_reference import TLGarbageHoles
from tetrio_fall_precision_reference import fall_probes, softdrop_budget, anti_stall_extra, kick_y
from tetrio_tl_v19_reference import TetraLeagueV19


def evaluate(req):
    kind = req['kind']
    if kind == 'bag':
        b = SevenBag(req['seed'])
        out = []
        for _ in range(req['count']):
            piece = b.pull()
            out.append(dict(piece=piece, queue=b.bag[:], bagId=b.bagid, seed=b.rng.seed))
        return out
    if kind == 'board':
        b = BoardReference()
        b.board = req['rows']
        results = dict(occupied=[b.occupied(x, y) for x, y in req['probes']],
                       lines=b.full_lines(), empty=b.is_empty(), perma=b.is_empty_with_perma(),
                       unclearable=b.is_empty_with_unclearable(), top=b.is_full_top_row())
        b.remove_lines(results['lines'])
        results['after'] = b.board
        return results
    if kind == 'holes':
        h = TLGarbageHoles(req['seed'])
        out = []
        for amount in req['packets']:
            holes = h.tank_packet(amount) if amount > 0 else h.cancel_whole_packet()
            out.append(dict(holes=holes, seed=h.rng.seed, column=h.lastcolumn, changed=h.haschangedcolumn))
        return out
    if kind == 'physics':
        return dict(probes=fall_probes(req['y'], req['step']),
                    soft=softdrop_budget(req['g'], req['dt'], req['sdf']),
                    anti=anti_stall_extra(req['limit'], req['rot'], req['dt']),
                    kick=kick_y(req['y'], req['kick'], 0, req['limit'], req['total']))
    if kind == 'tl':
        g = TetraLeagueV19()
        out = []
        for action in req['actions']:
            op = action['op']
            result = None
            if op == 'pending':
                result = g.inject_test_pending(action['amt'], active=action.get('active', True), hardened=action.get('hardened', False))
            elif op == 'lock':
                result = g.lock(lines=action['lines'], spin=action.get('spin', 'none'),
                                all_clear=action.get('allClear', False), garbage_rows_cleared=action.get('garbageRows', 0))
            elif op == 'receive':
                result = g.receive_interaction(action['event'])
            elif op == 'confirm':
                g.confirm_interaction(action['cid'])
            elif op == 'advance':
                g.advance_to(action['frame'])
            elif op == 'fight':
                result = g.fight_lines(action['amount'])
            else:
                raise ValueError(op)
            out.append(dict(result=result, combo=g.s.combo, btb=g.s.btb,
                            pending=g.pending_count(), sent=g.s.totals.sent,
                            generated=g.s.totals.attack_generated, cancelled=g.s.totals.cancelled,
                            tanked=g.s.totals.tanked, outbox=g.outbox[:]))
        return out
    raise ValueError(kind)


print(json.dumps([evaluate(req) for req in json.load(sys.stdin)]))
