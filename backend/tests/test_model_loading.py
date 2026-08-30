"""
backend/tests/test_model_loading.py

Tests for ML model loading, metadata extraction, and threshold validation.
"""

import unittest
from pathlib import Path
from services import ml_service
from config import get_settings


class TestModelLoading(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        settings = get_settings()
        ml_service.load_model(settings.model_path)

    def test_model_loaded_successfully(self):
        status = ml_service.model_status()
        self.assertTrue(status["loaded"], f"Model failed to load. Error: {status.get('error')}")
        self.assertEqual(status["type"], "lightgbm")

    def test_model_metadata(self):
        status = ml_service.model_status()
        self.assertAlmostEqual(status["optimal_threshold"], 0.387, places=2)
        self.assertIn("roc_auc", status["oof_metrics"])
        self.assertGreater(status["oof_metrics"]["roc_auc"], 0.70)
        self.assertGreater(status["n_training_rows"], 10000)

    def test_raw_feature_cols(self):
        status = ml_service.model_status()
        expected_cols = [
            "edition", "project_name", "agency", "state",
            "doa", "original_target_doa", "original_cost",
            "cumulative_expenditure", "physical_progress",
        ]
        self.assertEqual(status["raw_feature_cols"], expected_cols)


if __name__ == "__main__":
    unittest.main()
