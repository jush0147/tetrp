import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('holdout', Path(__file__).resolve().parents[1]/'scripts/kiwi-linear-value-holdout.py')
holdout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(holdout)


class HoldoutChecks(unittest.TestCase):
    def test_cluster_interval_counts_seed_groups_not_rows(self):
        differences = [-.1, .1]*10
        interval = holdout.improvement_interval(differences)
        self.assertAlmostEqual(interval['meanLogLossReduction'], 0)
        self.assertEqual(interval['pairedGroups'], 20)
        self.assertEqual(interval['improvedBlocks'], 10)
        self.assertAlmostEqual(interval['approx95CI'][1], 2.093 * (.01/19)**.5)
        self.assertAlmostEqual(interval['approx95CI'][0], -interval['approx95CI'][1])
        with self.assertRaises(AssertionError):
            holdout.improvement_interval(differences*100)

    def test_saved_model_prediction_matches_fit(self):
        import json
        import numpy as np
        x = np.array([[-1., 2], [1, 2]])
        model = holdout.pilot.fit(x, np.array([0., 1.]), np.ones(2))
        saved = json.loads(json.dumps(holdout.serialize(model)))
        for key in ['mean', 'scale', 'beta']:
            saved[key] = np.array(saved[key])
        np.testing.assert_array_equal(holdout.pilot.predict(model, x), holdout.pilot.predict(saved, x))


if __name__ == '__main__':
    unittest.main()
