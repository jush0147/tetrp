"""Offline diagnostic only: public-state win prediction, never imported by Kiwi.

Fixed plan: docs/audits/cc2-alignment/LINEAR_VALUE_PILOT_PLAN_2026-10-06.md
Requires the already bundled NumPy. No installs, arena, or search calls.
"""
import argparse
import gzip
import hashlib
import json
import platform
import subprocess
import time
from pathlib import Path

import numpy as np

FEATURES = [
    'max_height', 'mean_height', 'holes', 'covered_cells', 'roughness',
    'above_10', 'above_15', 'combo', 'btb', 'btb_charged',
    'pending', 'active_pending', 'are', 'multiplier', 'hold_available',
    'current_t', 'current_i', 'hold_t', 'hold_i', 'next_t_count', 'next_i_count',
    'visible_t_distance',
]
SIMPLE = [FEATURES.index(k) for k in ['max_height', 'holes', 'pending']]
RUN = 37452163955
REGULARIZATION = 0.01
MAX_STEPS = 500


def features(snapshot):
    """No request/report/identity/history input; board rows are top-to-bottom."""
    b = snapshot['board']
    rows = b['rows']
    assert b['width'] == 10 and len(rows) == b['height'] + b['buffer'] == 40
    assert len(snapshot['next']) == 5
    heights, holes, covered = [], 0, 0
    for x in range(10):
        col = [row[x] is not None for row in rows]
        top = next((y for y, filled in enumerate(col) if filled), 40)
        heights.append(40 - top)
        holes += sum(not filled for filled in col[top:])
        lowest_hole = max((y for y in range(top, 40) if not col[y]), default=-1)
        covered += sum(col[:lowest_hole]) if lowest_hole >= 0 else 0
    a = snapshot['attack']
    h = snapshot['hold']
    current = snapshot['current']['type'].lower()
    hold = (h['piece'] or '').lower()
    nxt = [p.lower() for p in snapshot['next']]
    maximum = max(heights)
    td = 0 if current == 't' or hold == 't' and not h['locked'] else next(
        (i + 1 for i, p in enumerate(nxt) if p == 't'), 6)
    out = [maximum, sum(heights) / 10, holes, covered,
           sum(abs(x-y) for x, y in zip(heights, heights[1:])),
           max(0, maximum-10), max(0, maximum-15), a['combo'], a['btb'],
           int(a['btb'] > snapshot['rules']['b2bcharge_at']),
           sum(p['amt'] for p in a['pending']),
           sum(p['amt'] for p in a['pending'] if p['active']),
           sum(p['amt'] for p in a['are']), a['multiplier'], int(not h['locked']),
           int(current == 't'), int(current == 'i'), int(hold == 't'), int(hold == 'i'),
           nxt.count('t'), nxt.count('i'), td]
    assert len(out) == len(FEATURES) and all(np.isfinite(out))
    return out


def objective_gradient(x, y, weight, beta):
    z = x @ beta
    probability = 1 / (1 + np.exp(-np.clip(z, -700, 700)))
    penalty = beta.copy()
    penalty[0] = 0  # unpenalized intercept
    loss = np.sum(weight * (np.logaddexp(0, z) - y*z)) + REGULARIZATION/2 * (penalty @ penalty)
    gradient = x.T @ (weight * (probability-y)) + REGULARIZATION*penalty
    return float(loss), gradient


def fit(x, y, weight):
    started = time.perf_counter()
    weight = weight / weight.sum()
    mean = np.sum(x * weight[:, None], axis=0)
    scale = np.sqrt(np.sum((x-mean)**2 * weight[:, None], axis=0))
    scale[scale < 1e-12] = 1
    design = np.column_stack([np.ones(len(x)), (x-mean)/scale])
    # Hessian of logistic data loss <= X'WX/4, plus ridge on slopes.
    bound = np.linalg.eigvalsh(design.T @ (weight[:, None]*design))[-1]/4 + REGULARIZATION
    beta = np.zeros(design.shape[1])
    losses = []
    for step in range(MAX_STEPS):
        loss, grad = objective_gradient(design, y, weight, beta)
        losses.append(loss)
        if np.max(np.abs(grad)) < 1e-7:
            break
        beta -= grad/bound
    final_loss, gradient = objective_gradient(design, y, weight, beta)
    assert final_loss <= losses[0] + 1e-10
    assert all(b <= a + 1e-10 for a, b in zip(losses, losses[1:]))
    return {'mean': mean, 'scale': scale, 'beta': beta,
            'iterations': step+1, 'loss': final_loss,
            'maxAbsGradient': float(np.max(np.abs(gradient))),
            'seconds': time.perf_counter()-started}


def predict(model, x):
    z = model['beta'][0] + ((x-model['mean'])/model['scale']) @ model['beta'][1:]
    return 1/(1+np.exp(-np.clip(z, -700, 700)))


def metrics(y, p, weights):
    if not len(y):
        return None
    weights = weights/weights.sum()
    p = np.clip(p, 1e-12, 1-1e-12)
    return {'rows': len(y), 'logLoss': float(-np.sum(weights*(y*np.log(p)+(1-y)*np.log1p(-p)))),
            'brier': float(np.sum(weights*(p-y)**2))}


def finite_difference_check():
    rng = np.random.default_rng(1827)
    x = np.column_stack([np.ones(12), rng.normal(size=(12, 4))])
    y = np.array([0, 1]*6)
    w = np.arange(1, 13, dtype=float); w /= w.sum()
    beta = rng.normal(size=5)
    _, analytic = objective_gradient(x, y, w, beta)
    numeric = []
    for i in range(5):
        delta = np.zeros(5); delta[i] = 1e-6
        numeric.append((objective_gradient(x, y, w, beta+delta)[0] -
                        objective_gradient(x, y, w, beta-delta)[0])/2e-6)
    error = float(np.max(np.abs(analytic-numeric)))
    assert error < 1e-7
    return error


def load_examples(root, blocks):
    """Shared fixed sampling/audit; caller selects whole seed groups, never rows."""
    inventory = subprocess.run(['rg', '--files', '--hidden', '.cache', '-g', '*reports*.jsonl',
                                '-g', '*reports*.jsonl.gz'], capture_output=True, text=True, check=True)
    local_paths = inventory.stdout.splitlines()
    aggregate = json.loads(Path('.cache/residual-arena-37452163955/result.json').read_text())
    assert aggregate['complete'] and not aggregate['errors']
    frozen_games = {(b['block'], leg): g for b in aggregate['blocks']
                    for leg, g in enumerate(b['attempts'][0]['games']) if b['attempt'] == 0}
    examples, games, seen = [], [], set()
    for block in blocks:
        for leg in range(2):
            paths = list(root.glob(f'**/block-{block}/attempt-0/leg-{leg}/reports.jsonl.gz'))
            assert len(paths) == 1, (block, leg, paths)
            path = paths[0]
            g = json.loads(path.with_name('result.json').read_text())
            assert g == frozen_games[(block, leg)], 'trace result must equal verified run aggregate'
            r = g['result']; setting = g['setting']
            # Use the existing authority audit, rather than duplicating its rule contract.
            js = "import{readFileSync}from'node:fs';import{auditGame}from'./scripts/kiwi-residual-arena-plan.js';const g=JSON.parse(readFileSync(process.argv[1]));const s=g.setting;console.log(JSON.stringify(auditGame(g,s.block,s.leg,s.attempt)));"
            audited = json.loads(subprocess.run(['node', '--input-type=module', '-e', js,
                                                 str(path.with_name('result.json'))],
                                                check=True, capture_output=True, text=True).stdout)
            assert audited['scored'] and r['winner'] in [0, 1]
            assert setting == {'block': block, 'leg': leg, 'attempt': 0, 'seat': leg,
                               'seed': 2026210001 + block*100}
            game_id = f'{RUN}/{block}/{leg}'
            assert game_id not in seen; seen.add(game_id)
            requests = [0, 0]; selected = [[], []]; buckets = [set(), set()]
            source_hash = hashlib.sha256()
            with gzip.open(path, 'rb') as f:
                for line in f:
                    source_hash.update(line)
                    report = json.loads(line)
                    seat = report['seat']; requests[seat] += 1
                    assert report['nativeHash'] == g['nativeHashes'][seat]
                    s = report['snapshot']
                    bucket = s['piecesPlaced']//8
                    if not s['playing'] or s['current'] is None or s['hold']['locked']:
                        continue
                    if bucket in buckets[seat] or len(selected[seat]) >= 64:
                        continue
                    buckets[seat].add(bucket)
                    # Outcome only labels the row, never enters feature extraction.
                    selected[seat].append({'x': features(s), 'y': int(seat == r['winner']),
                                           'block': block, 'game': game_id, 'seat': seat,
                                           'frame': s['frame']})
            assert requests == g['counts']['requests']
            assert all(selected)
            for side in selected:
                for row in side:
                    row['weight'] = .5/len(side)
                    examples.append(row)
            games.append({'game': game_id, 'seed': setting['seed'], 'block': block,
                          'winner': r['winner'], 'requests': requests,
                          'sampled': [len(a) for a in selected], 'path': path.as_posix(),
                          'uncompressedReportsSHA256': source_hash.hexdigest(),
                          'compressedBytes': path.stat().st_size})
    return examples, games, local_paths


def run(root, output):
    start = time.perf_counter()
    output.mkdir(parents=True, exist_ok=True)
    examples, games, local_paths = load_examples(root, range(20))
    data_seconds = time.perf_counter()-start
    x = np.array([e['x'] for e in examples], dtype=float)
    y = np.array([e['y'] for e in examples], dtype=float)
    w = np.array([e['weight'] for e in examples])
    groups = np.array([e['block'] for e in examples])
    early = np.array([e['frame'] <= 1200 for e in examples])
    predictions = {'constant': np.full(len(y), .5), 'simple': np.zeros(len(y)), 'full': np.zeros(len(y))}
    folds = []
    for fold in range(5):
        test = groups % 5 == fold; train = ~test
        assert not set(groups[train]) & set(groups[test])
        row = {'fold': fold, 'trainBlocks': sorted(set(groups[train].tolist())),
               'testBlocks': sorted(set(groups[test].tolist())), 'models': {}}
        for name, cols in [('simple', SIMPLE), ('full', list(range(len(FEATURES))))]:
            model = fit(x[train][:, cols], y[train], w[train])
            predictions[name][test] = predict(model, x[test][:, cols])
            row['models'][name] = {k: (v.tolist() if isinstance(v, np.ndarray) else v) for k, v in model.items()}
            row['models'][name]['heldOut'] = metrics(y[test], predictions[name][test], w[test])
        folds.append(row)
    # Early-only metric reweights each represented game/side equally again.
    early_w = np.zeros(len(y))
    for game in games:
        for seat in [0, 1]:
            ids = [i for i, e in enumerate(examples) if e['game'] == game['game'] and e['seat'] == seat and early[i]]
            assert ids
            early_w[ids] = .5/len(ids)
    by_block = []
    for b in range(20):
        ids = groups == b
        by_block.append({'block': b, 'metrics': {n: metrics(y[ids], p[ids], w[ids]) for n, p in predictions.items()}})
    result = {'schema': 'kiwi-linear-offline-pilot/1', 'sourceRun': RUN,
              'purpose': 'Feasibility and exploratory grouped prediction only; no deployable evaluator or strength claim.',
              'localReportFileCount': len(local_paths), 'localReportPaths': local_paths,
              'games': games, 'features': FEATURES, 'sampleRows': len(y), 'seedGroups': 20,
              'featureMatrixBytesFloat64': x.nbytes, 'dataSeconds': data_seconds,
              'trainingSeconds': sum(m['seconds'] for f in folds for m in f['models'].values()),
              'totalSeconds': time.perf_counter()-start, 'numpy': np.__version__, 'python': platform.python_version(),
              'gradientCheckMaxError': finite_difference_check(), 'regularization': REGULARIZATION,
              'folds': folds, 'blockMetrics': by_block,
              'outOfFold': {n: metrics(y, p, w) for n, p in predictions.items()},
              'earlyOutOfFold': {n: metrics(y[early], p[early], early_w[early]) for n, p in predictions.items()},
              'limitations': ['Only 20 independent paired seed groups and one bot matchup.',
                             'CV is exploratory, not independent final candidate validation.',
                             'Root snapshots differ from internal search leaves.',
                             'Linear effects and partial piece-supply summaries omit interactions and geometry.',
                             'Same-game labels correlate; no snapshot-level significance claims.',
                             'Win logit cannot be directly added to existing attack rewards.']}
    (output/'result.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    with (output/'sampled-features.jsonl').open('w', encoding='utf-8') as f:
        for i, e in enumerate(examples):
            f.write(json.dumps({**e, 'outOfFold': {n: float(p[i]) for n, p in predictions.items()}})+'\n')
    print(json.dumps({k: result[k] for k in ['sampleRows', 'seedGroups', 'dataSeconds', 'trainingSeconds',
                                           'featureMatrixBytesFloat64', 'outOfFold', 'earlyOutOfFold']}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('.cache/linear-value-pilot/traces'))
    parser.add_argument('--output', type=Path, default=Path('.cache/linear-value-pilot/output'))
    parser.add_argument('--self-check', action='store_true')
    args = parser.parse_args()
    if args.self_check:
        print(json.dumps({'gradientCheckMaxError': finite_difference_check()}))
    else:
        run(args.root, args.output)
