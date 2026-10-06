"""One frozen train/holdout evaluation, no tuning or bot integration."""
import argparse
import hashlib
import importlib.util
import json
import math
import time
from pathlib import Path

import numpy as np

spec = importlib.util.spec_from_file_location('pilot', Path(__file__).with_name('kiwi-linear-value-pilot.py'))
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


def arrays(examples):
    return (np.array([e['x'] for e in examples], dtype=float),
            np.array([e['y'] for e in examples], dtype=float),
            np.array([e['weight'] for e in examples]))


def serialize(model):
    return {k: v.tolist() if isinstance(v, np.ndarray) else v for k, v in model.items()}


def improvement_interval(differences):
    """20 paired seed clusters; approximate two-sided t interval, not KO CI."""
    assert len(differences) == 20
    mean = float(np.mean(differences))
    se = float(np.std(differences, ddof=1)/math.sqrt(20))
    return {'meanLogLossReduction': mean, 'approx95CI': [mean-2.093*se, mean+2.093*se],
            'improvedBlocks': sum(d > 0 for d in differences), 'pairedGroups': 20}


def main(root, output):
    started = time.perf_counter()
    output.mkdir(parents=True, exist_ok=True)
    train, train_games, _ = pilot.load_examples(root, range(80))
    train_data_seconds = time.perf_counter()-started
    # Check the refactored sampling against the untouched saved pilot sample.
    old = [json.loads(line) for line in Path('.cache/linear-value-pilot/output/sampled-features.jsonl').read_text().splitlines()]
    before = [{k: v for k, v in e.items() if k != 'outOfFold'} for e in old]
    assert [e for e in train if e['block'] < 20] == before
    assert len({g['seed'] for g in train_games}) == 80
    x, y, w = arrays(train)
    assert abs(w.sum()-160) < 1e-9 and abs((w*y).sum()-80) < 1e-9
    models = {}
    train_metrics = {'constant': pilot.metrics(y, np.full(len(y), .5), w)}
    for name, cols in [('simple', pilot.SIMPLE), ('full', list(range(len(pilot.FEATURES))))]:
        fitted = pilot.fit(x[:, cols], y, w)
        models[name] = {'columns': cols, 'fit': serialize(fitted)}
        train_metrics[name] = pilot.metrics(y, pilot.predict(fitted, x[:, cols]), w)
    model_path = output/'frozen-models.json'
    model_path.write_text(json.dumps({'features': pilot.FEATURES, 'trainBlocks': list(range(80)),
                                     'regularization': pilot.REGULARIZATION, 'maxSteps': pilot.MAX_STEPS,
                                     'models': models}, indent=2)+'\n', encoding='utf-8')
    model_hash = hashlib.sha256(model_path.read_bytes()).hexdigest()
    print(json.dumps({'phase': 'models_frozen_before_holdout', 'trainingRows': len(train),
                      'modelSHA256': model_hash,
                      'trainingSeconds': sum(m['fit']['seconds'] for m in models.values())}), flush=True)
    holdout_started = time.perf_counter()
    test, test_games, _ = pilot.load_examples(root, range(80, 100))
    holdout_data_seconds = time.perf_counter()-holdout_started
    assert not {g['seed'] for g in train_games} & {g['seed'] for g in test_games}
    tx, ty, tw = arrays(test)
    assert abs(tw.sum()-40) < 1e-9 and abs((tw*ty).sum()-20) < 1e-9
    # Predict from the saved model; no further fit or updates are allowed.
    frozen = json.loads(model_path.read_text())
    predictions = {'constant': np.full(len(test), .5)}
    for name, entry in frozen['models'].items():
        fitted = entry['fit']
        for key in ['mean', 'scale', 'beta']:
            fitted[key] = np.array(fitted[key])
        predictions[name] = pilot.predict(fitted, tx[:, entry['columns']])
    assert hashlib.sha256(model_path.read_bytes()).hexdigest() == model_hash
    early = np.array([e['frame'] <= 1200 for e in test])
    early_weights = np.zeros(len(test))
    for game in test_games:
        for seat in [0, 1]:
            ids = [i for i, e in enumerate(test) if e['game'] == game['game'] and e['seat'] == seat and early[i]]
            assert ids
            early_weights[ids] = .5/len(ids)
    block_metrics = []
    for b in range(80, 100):
        mask = np.array([e['block'] == b for e in test])
        block_metrics.append({'block': b, 'metrics': {n: pilot.metrics(ty[mask], p[mask], tw[mask])
                                                     for n, p in predictions.items()}})
    comparisons = {name: improvement_interval([b['metrics'][name]['logLoss']-b['metrics']['full']['logLoss']
                                               for b in block_metrics]) for name in ['constant', 'simple']}
    early_metrics = {n: pilot.metrics(ty[early], p[early], early_weights[early]) for n, p in predictions.items()}
    gate = (all(c['approx95CI'][0] > 0 for c in comparisons.values()) and
            early_metrics['full']['logLoss'] <= early_metrics['constant']['logLoss'])
    result = {'schema': 'kiwi-linear-fixed-holdout/1', 'sourceRun': pilot.RUN,
              'trainBlocks': list(range(80)), 'holdoutBlocks': list(range(80, 100)),
              'trainRows': len(train), 'holdoutRows': len(test),
              'games': train_games+test_games, 'features': pilot.FEATURES,
              'pilotSamplingParity': True, 'gradientCheckMaxError': pilot.finite_difference_check(),
              'trainDataSeconds': train_data_seconds, 'holdoutDataSeconds': holdout_data_seconds,
              'trainingSeconds': sum(m['fit']['seconds'] for m in models.values()),
              'totalSeconds': time.perf_counter()-started, 'featureMatrixBytesFloat64': x.nbytes+tx.nbytes,
              'models': models, 'frozenModelSHA256': model_hash,
              'trainingMetricsDiagnosticOnly': train_metrics,
              'holdoutMetrics': {n: pilot.metrics(ty, p, tw) for n, p in predictions.items()},
              'earlyHoldoutMetrics': early_metrics, 'blockMetrics': block_metrics,
              'comparisons': comparisons, 'meetsPredictionSignalGate': gate,
              'strengthEvidence': False, 'automaticArena': False,
              'limitations': ['Only 20 paired seed clusters in holdout, one matchup; approximate cluster t intervals.',
                             'Entire run outcomes were previously reviewed; block90 terminal Hold inspected, not a historically blind dataset.',
                             'No holdout features or labels used in fitting or hyperparameter selection.',
                             'Root-to-leaf distribution and value/reward contract unresolved; not a deployable evaluator.']}
    (output/'result.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    with (output/'holdout-predictions.jsonl').open('w', encoding='utf-8') as f:
        for i, e in enumerate(test):
            f.write(json.dumps({**e, 'predictions': {n: float(p[i]) for n, p in predictions.items()}})+'\n')
    print(json.dumps({k: result[k] for k in ['trainRows', 'holdoutRows', 'trainingSeconds',
                                           'holdoutMetrics', 'earlyHoldoutMetrics', 'comparisons',
                                           'meetsPredictionSignalGate']}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path('.cache/linear-value-pilot/traces'))
    parser.add_argument('--output', type=Path, default=Path('.cache/linear-value-holdout'))
    args = parser.parse_args()
    main(args.root, args.output)
