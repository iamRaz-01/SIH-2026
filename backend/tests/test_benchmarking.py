"""
backend/tests/test_benchmarking.py

Tests for Cohort Benchmarking service and APIs.
"""

import unittest
from fastapi.testclient import TestClient
from main import app
from services import dataset_service
from config import get_settings


class TestBenchmarking(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        settings = get_settings()
        dataset_service.load_dataset(settings.dataset_path)
        cls.client = TestClient(app)

    def test_cohorts_summary(self):
        res = self.client.get("/api/benchmarks/cohorts")
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertIn("national_avg_cost_overrun_pct", data)
        self.assertIn("state_benchmarks", data)
        self.assertIn("agency_benchmarks", data)

    def test_project_benchmarks(self):
        res = self.client.get("/api/benchmarks/701107")
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["project_code"], "701107")
        self.assertIn("benchmarks", data)

        benchmarks = data["benchmarks"]
        self.assertIn("state_cohort", benchmarks)
        self.assertIn("agency_cohort", benchmarks)
        self.assertIn("scale_cohort", benchmarks)
        self.assertIn("national_cohort", benchmarks)

        nat_stats = benchmarks["national_cohort"]["statistics"]
        self.assertIn("cost_overrun_pct", nat_stats)
        self.assertIn("project_percentile", nat_stats["cost_overrun_pct"])


if __name__ == "__main__":
    unittest.main()
