"""
backend/tests/test_edge_cases.py

Tests for edge cases:
  - Nonexistent project code (404)
  - Invalid prediction inputs
  - Health check endpoint
"""

import unittest
from fastapi.testclient import TestClient
from main import app
from services import dataset_service, ml_service, anomaly_service, network_service
from config import get_settings


class TestEdgeCases(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        settings = get_settings()
        df = dataset_service.load_dataset(settings.dataset_path)
        ml_service.load_model(settings.model_path)
        anomaly_service.fit_anomaly_model(df, contamination=0.05)
        network_service.build_network(df)
        cls.client = TestClient(app)

    def test_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["dataset"]["loaded"])
        self.assertTrue(data["ml_model"]["loaded"])
        self.assertTrue(data["anomaly_detector"]["fitted"])

    def test_invalid_project_code_predict(self):
        res = self.client.post(
            "/api/predict/cost-overrun",
            json={"project_code": "NON_EXISTENT_PROJECT_CODE_99999999"}
        )
        self.assertEqual(res.status_code, 404)

    def test_invalid_project_code_anomaly(self):
        res = self.client.get("/api/anomalies/NON_EXISTENT_PROJECT_CODE_99999999")
        self.assertEqual(res.status_code, 404)

    def test_invalid_project_code_risk(self):
        res = self.client.get("/api/risk/NON_EXISTENT_PROJECT_CODE_99999999")
        self.assertEqual(res.status_code, 404)

    def test_invalid_project_code_benchmark(self):
        res = self.client.get("/api/benchmarks/NON_EXISTENT_PROJECT_CODE_99999999")
        self.assertEqual(res.status_code, 404)


if __name__ == "__main__":
    unittest.main()
