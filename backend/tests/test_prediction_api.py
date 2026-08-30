"""
backend/tests/test_prediction_api.py

Tests for ML Prediction API and Tree SHAP Explainability.
"""

import unittest
from fastapi.testclient import TestClient
from main import app
from services import dataset_service, ml_service
from config import get_settings


class TestPredictionAPI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        settings = get_settings()
        dataset_service.load_dataset(settings.dataset_path)
        ml_service.load_model(settings.model_path)
        cls.client = TestClient(app)

    def test_predict_with_real_project_code(self):
        # Project 701107 exists in dataset (Vijayawada Airport)
        res = self.client.post(
            "/api/predict/cost-overrun",
            json={"project_code": "701107"}
        )
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["project_code"], "701107")
        self.assertIn("cost_overrun_probability", data)
        self.assertIsInstance(data["cost_overrun_probability"], float)
        self.assertIn(data["risk_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIn(data["prediction"], ["LIKELY_COST_OVERRUN", "NORMAL"])
        self.assertEqual(data["provenance"], "MODEL_OUTPUT")

    def test_predict_with_raw_features(self):
        payload = {
            "project_name": "New Railway Line Construction Project",
            "agency": "Rail Vikas Nigam Limited [RVNL]",
            "state": "Bihar",
            "original_cost": 850.0,
            "cumulative_expenditure": 620.0,
            "physical_progress": 45.0,
            "doa": "2019-03-01",
            "original_target_doa": "2023-03-01",
            "edition": "2025-07-01",
        }
        res = self.client.post("/api/predict/cost-overrun", json=payload)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIsNotNone(data["cost_overrun_probability"])
        self.assertIn(data["risk_level"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])

    def test_explain_prediction_shap(self):
        res = self.client.post(
            "/api/predict/explain?top_n=5",
            json={"project_code": "701107"}
        )
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIn("top_contributing_features", data)
        self.assertLessEqual(len(data["top_contributing_features"]), 5)
        self.assertIn("base_value_log_odds", data)

        top_feat = data["top_contributing_features"][0]
        self.assertIn("feature", top_feat)
        self.assertIn("shap_value", top_feat)
        self.assertIn("impact", top_feat)
        self.assertIn(top_feat["impact"], ["INCREASES_RISK", "DECREASES_RISK", "NEUTRAL"])
        self.assertIn("explanation", top_feat)

    def test_batch_predict(self):
        res = self.client.post("/api/predict/batch?limit=10")
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["total_scored"], 10)
        self.assertEqual(len(data["predictions"]), 10)


if __name__ == "__main__":
    unittest.main()
