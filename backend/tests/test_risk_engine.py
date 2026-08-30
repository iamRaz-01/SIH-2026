"""
backend/tests/test_risk_engine.py

Tests for the Unified Risk Engine.
Verifies:
  - Provenance separation (MODEL_OUTPUT vs DERIVED_ANALYTICS)
  - Composite scoring and level classification
  - API endpoint responses
"""

import unittest
from fastapi.testclient import TestClient
from main import app
from services import dataset_service, ml_service, anomaly_service
from config import get_settings


class TestRiskEngine(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        settings = get_settings()
        df = dataset_service.load_dataset(settings.dataset_path)
        ml_service.load_model(settings.model_path)
        anomaly_service.fit_anomaly_model(df, contamination=0.05)
        cls.client = TestClient(app)

    def test_evaluate_project_risk_endpoint(self):
        res = self.client.get("/api/risk/701107")
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()

        # Check provenance separation
        self.assertIn("model_output", data)
        self.assertEqual(data["model_output"]["provenance"], "MODEL_OUTPUT")

        self.assertIn("derived_analytics", data)
        self.assertEqual(data["derived_analytics"]["provenance"], "DERIVED_ANALYTICS")

        self.assertIn("overall_risk", data)
        self.assertEqual(data["overall_risk"]["provenance"], "SYNTHESIZED_ANALYTICS")

        # Check sub-indices
        derived = data["derived_analytics"]
        self.assertIn("cost_risk", derived)
        self.assertIn("schedule_risk", derived)
        self.assertIn("implementation_indicators", derived)
        self.assertIn("anomaly_status", derived)

    def test_custom_payload_risk_evaluation(self):
        payload = {
            "project_name": "Major Metro Corridor Extension",
            "agency": "RVNL",
            "state": "West Bengal",
            "original_cost": 2500.0,
            "revised_cost": 3400.0,
            "cumulative_expenditure": 2100.0,
            "physical_progress": 52.0,
            "doa": "2018-05-01",
            "original_target_doa": "2022-05-01",
            "revised_completion": "2025-12-01",
        }
        res = self.client.post("/api/risk/evaluate", json=payload)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertGreater(data["overall_risk"]["score"], 0.0)


if __name__ == "__main__":
    unittest.main()
