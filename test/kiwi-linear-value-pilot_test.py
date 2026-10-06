"""Numerics and snapshot boundary checks for the offline diagnostic."""
import copy
import importlib.util
from pathlib import Path
import unittest

import numpy as np

spec = importlib.util.spec_from_file_location('pilot', Path(__file__).resolve().parents[1]/'scripts/kiwi-linear-value-pilot.py')
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


def snapshot():
    return {'board': {'width': 10, 'height': 20, 'buffer': 20, 'rows': [[None]*10 for _ in range(40)]},
            'current': {'type': 's'}, 'hold': {'piece': None, 'locked': False},
            'next': ['i', 'o', 't', 'j', 'l'], 'rules': {'b2bcharge_at': 4},
            'attack': {'combo': 0, 'btb': 0, 'pending': [], 'are': [], 'multiplier': 1}}


class PilotChecks(unittest.TestCase):
    def test_top_down_geometry(self):
        s = snapshot()
        # One cell over one hole; another column supported to floor.
        s['board']['rows'][38][0] = 't'
        s['board']['rows'][39][1] = 'i'
        f = dict(zip(pilot.FEATURES, pilot.features(s)))
        self.assertEqual(f['max_height'], 2)
        self.assertEqual(f['holes'], 1)
        self.assertEqual(f['covered_cells'], 1)
        self.assertAlmostEqual(f['mean_height'], .3)
        self.assertEqual(f['roughness'], 2)

    def test_no_history_identity_or_future_features(self):
        s = snapshot(); other = copy.deepcopy(s)
        other.update(seed=17, seat=1, winner=0, piecesPlaced=777, hiddenQueue=['t']*9,
                     report={'score': 9999}, action={'kind': 'hold'}, bot='candidate')
        self.assertEqual(pilot.features(s), pilot.features(other))
        other['next'] = ['i']*6
        with self.assertRaises(AssertionError):
            pilot.features(other)

    def test_logistic_gradient_against_finite_differences(self):
        self.assertLess(pilot.finite_difference_check(), 1e-7)

    def test_solver_and_train_only_scaling(self):
        x = np.array([[-2., 3], [-1, 3], [1, 3], [2, 3]])
        y = np.array([0., 0., 1., 1.])
        model = pilot.fit(x, y, np.ones(4))
        np.testing.assert_allclose(model['mean'], [0, 3])
        self.assertEqual(model['scale'][1], 1)
        self.assertLess(pilot.metrics(y, pilot.predict(model, x), np.ones(4))['logLoss'], .2)
        before = model['mean'].copy()
        self.assertTrue(np.isfinite(pilot.predict(model, np.array([[1e6, -1e6]]))).all())
        np.testing.assert_array_equal(model['mean'], before)


if __name__ == '__main__':
    unittest.main()
