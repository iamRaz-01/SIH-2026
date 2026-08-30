"""
backend/tests/test_missing_values.py

Tests for missing values, corrupt data, and zero/negative costs across the pipeline.
"""

import math
import unittest
import numpy as np
import pandas as pd

from pipeline.feature_engineering import FeatureEngineer, calc_all_features
from services import ml_service
from config import get_settings


class TestMissingValues(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        settings = get_settings()
        ml_service.load_model(settings.model_path)

    def test_missing_features_prediction_handling(self):
        # Empty dict should return Insufficient Data without throwing 500 error
        res = ml_service.predict_cost_overrun({})
        self.assertEqual(res["status"], "Insufficient Data")
        self.assertIsNone(res["cost_overrun_probability"])
        self.assertIn("missing_fields", res)

    def test_partial_features_prediction(self):
        # Has basic numeric fields but missing dates, edition, etc.
        res = ml_service.predict_cost_overrun({
            "original_cost": 500.0,
            "cumulative_expenditure": 250.0,
            "physical_progress": 50.0,
        })
        self.assertIsNotNone(res["cost_overrun_probability"])
        self.assertEqual(res["status"], "Scored")

    def test_feature_engineer_with_all_nans(self):
        fe = FeatureEngineer()
        nan_df = pd.DataFrame([{
            "project_name": None,
            "agency": None,
            "state": None,
            "doa": None,
            "original_target_doa": None,
            "original_cost": np.nan,
            "cumulative_expenditure": np.nan,
            "physical_progress": np.nan,
            "edition": None,
        }])
        X_out = fe.transform(nan_df)
        self.assertEqual(X_out.shape, (1, 23))


if __name__ == "__main__":
    unittest.main()
