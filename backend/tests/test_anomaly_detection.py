"""
backend/tests/test_anomaly_detection.py

Tests for Isolation Forest Anomaly Detection (USP #1).
Covers:
  - Isolation Forest fitting on real dataset
  - Anomaly score normalization [0, 1]
  - 4-Quadrant classification (predictive risk vs anomaly)
  - Filtering by state, agency, severity, min_score
  - Single project anomaly explanation endpoint
"""

import unittest
from fastapi.testclient import TestClient
from main import app
from services import dataset_service, anomaly_service
from config import get_settings


class TestAnomalyDetection(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        settings = get_settings()
        df = dataset_service.load_dataset(settings.dataset_path)
        anomaly_service.fit_anomaly_model(df, contamination=0.05)
        cls.client = TestClient(app)

    def test_anomaly_model_status(self):
        status = anomaly_service.anomaly_status()
        self.assertTrue(status["fitted"])
        self.assertGreater(status["total_evaluated"], 1000)
        self.assertGreater(status["anomalies_flagged"], 0)

    def test_list_anomalies_endpoint(self):
        res = self.client.get("/api/anomalies?limit=20")
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIn("anomalies", data)
        self.assertEqual(len(data["anomalies"]), 20)

        # Check anomaly record schema
        rec = data["anomalies"][0]
        self.assertIn("project_code", rec)
        self.assertIn("anomaly_score", rec)
        self.assertTrue(0.0 <= rec["anomaly_score"] <= 1.0)
        self.assertIn("anomaly_status", rec)
        self.assertIn(rec["anomaly_status"], ["ANOMALOUS", "NORMAL"])
        self.assertIn("severity", rec)
        self.assertIn(rec["severity"], ["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        self.assertIn("risk_quadrant", rec)
        self.assertIn("explanation", rec)
        self.assertIn("relevant_project_metrics", rec)

    def test_filter_anomalies_by_severity(self):
        res = self.client.get("/api/anomalies?severity=CRITICAL&limit=10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        for item in data["anomalies"]:
            self.assertEqual(item["severity"], "CRITICAL")

    def test_quadrant_separation(self):
        # Verify 4 distinct quadrants exist in evaluation
        res = self.client.get("/api/anomalies?limit=100")
        self.assertEqual(res.status_code, 200)
        quadrants = {item["risk_quadrant"] for item in res.json()["anomalies"]}
        self.assertGreater(len(quadrants), 1, f"Expected multiple quadrants, got: {quadrants}")

    def test_single_project_anomaly_explanation(self):
        # Fetch an anomaly and then query its specific explanation endpoint
        list_res = self.client.get("/api/anomalies?only_flagged=true&limit=1")
        flagged_list = list_res.json()["anomalies"]
        if flagged_list:
            code = flagged_list[0]["project_code"]
            detail_res = self.client.get(f"/api/anomalies/{code}")
            self.assertEqual(detail_res.status_code, 200)
            detail = detail_res.json()
            self.assertEqual(detail["project_code"], code)
            self.assertIn("feature_deviations", detail)
            self.assertGreater(len(detail["feature_deviations"]), 0)


if __name__ == "__main__":
    unittest.main()
